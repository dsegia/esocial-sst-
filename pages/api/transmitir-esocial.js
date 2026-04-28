// pages/api/transmitir-esocial.js
// Transmite eventos assinados ao webservice SOAP do eSocial

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIP } from '../../lib/rate-limit'
import { requireAuth } from '../../lib/auth-middleware'

const ENDPOINTS = {
  producao_restrita: 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/envioLoteEventos/enviarLoteEventos/v1_1_0/index.php',
  producao:          'https://webservices.esocial.gov.br/servicos/empregador/envioLoteEventos/enviarLoteEventos/v1_1_0/index.php',
}

const sbAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const user = await requireAuth(req, res)
  if (!user) return

  const ip = getClientIP(req)
  const { limited, retryAfter } = checkRateLimit(ip, { windowMs: 60_000, max: 10 })
  if (limited) return res.status(429).json({ erro: 'Muitas requisições. Tente novamente em breve.', retryAfter })

  // Resolve empresa_id do usuário autenticado
  const { data: usuarioDb } = await sbAdmin
    .from('usuarios').select('empresa_id').eq('id', user.id).single()
  const empresaId = usuarioDb?.empresa_id || user.user_metadata?.empresa_id

  if (!empresaId) return res.status(403).json({ erro: 'Empresa não encontrada para este usuário' })

  // Verifica e consome crédito de envio
  const { data: empresa } = await sbAdmin
    .from('empresas')
    .select('id, plano, creditos_restantes, stripe_customer_id')
    .eq('id', empresaId).single()

  if (!empresa) return res.status(403).json({ erro: 'Empresa não encontrada' })

  if (empresa.plano === 'cancelado') {
    return res.status(403).json({ erro: 'Assinatura cancelada. Acesse /planos para reativar.', sem_creditos: true })
  }

  if (empresa.creditos_restantes > 0) {
    // Consome 1 crédito incluído
    await sbAdmin.from('empresas')
      .update({ creditos_restantes: empresa.creditos_restantes - 1 })
      .eq('id', empresaId)
  } else if (empresa.stripe_customer_id && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_METER_ENVIOS) {
    // Créditos esgotados — registra evento no meter do Stripe (cobrado no fechamento do ciclo)
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
      await stripe.billing.meterEvents.create({
        event_name: 'esocial_envio',
        payload: {
          value: '1',
          stripe_customer_id: empresa.stripe_customer_id,
        },
      })
    } catch (err) {
      console.error('[transmitir] erro ao registrar uso metered:', err?.message)
      return res.status(500).json({ erro: 'Erro ao registrar envio excedente. Tente novamente.' })
    }
  } else if (empresa.plano !== 'trial' && empresa.plano !== 'enterprise') {
    return res.status(402).json({
      erro: 'Créditos de envio esgotados. Acesse Planos para adquirir um plano com mais envios.',
      sem_creditos: true,
    })
  }

  const { xml_assinado, cnpj_empregador, ambiente = 'producao_restrita', transmissao_id } = req.body

  if (!xml_assinado || !cnpj_empregador) {
    return res.status(400).json({ erro: 'XML assinado e CNPJ são obrigatórios' })
  }

  const endpoint = ENDPOINTS[ambiente]
  if (!endpoint) return res.status(400).json({ erro: 'Ambiente inválido' })

  try {
    const nrLote = Date.now().toString()
    const dataHoraTransmissao = new Date().toISOString()

    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:v1="http://www.esocial.gov.br/servicos/empregador/envioLoteEventos/enviarLoteEventos/v1_1_0">
  <soapenv:Header/>
  <soapenv:Body>
    <v1:EnviarLoteEventosRequest>
      <loteEventos>
        <eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1">
          <envioLoteEventos grupo="1">
            <ideEmpregador>
              <tpInsc>1</tpInsc>
              <nrInsc>${cnpj_empregador.replace(/\D/g,'').substring(0,8)}</nrInsc>
            </ideEmpregador>
            <ideTransmissor>
              <tpInsc>1</tpInsc>
              <nrInsc>${cnpj_empregador.replace(/\D/g,'')}</nrInsc>
            </ideTransmissor>
            <eventos>
              <evento Id="ev1">
                ${xml_assinado}
              </evento>
            </eventos>
          </envioLoteEventos>
        </eSocial>
      </loteEventos>
    </v1:EnviarLoteEventosRequest>
  </soapenv:Body>
</soapenv:Envelope>`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '"enviarLoteEventos"',
      },
      body: soapEnvelope,
      signal: AbortSignal.timeout(30000),
    })

    const resBody = await response.text()

    const recibo    = resBody.match(/<nrRec>([^<]+)<\/nrRec>/)?.[1]
    const cdResp    = resBody.match(/<cdResp>([^<]+)<\/cdResp>/)?.[1]
    const descResp  = resBody.match(/<descResp>([^<]+)<\/descResp>/)?.[1]
    const ocorrencias = [...resBody.matchAll(/<dsMsg>([^<]+)<\/dsMsg>/g)].map(m => m[1])

    if (recibo) {
      return res.status(200).json({
        sucesso: true,
        recibo,
        codigo: cdResp,
        descricao: descResp,
        ambiente,
        data_envio: dataHoraTransmissao,
      })
    }

    if (cdResp && parseInt(cdResp) > 0) {
      return res.status(422).json({
        sucesso: false,
        codigo: cdResp,
        descricao: descResp,
        ocorrencias,
        xml_resposta: resBody.substring(0, 1000),
      })
    }

    return res.status(500).json({
      sucesso: false,
      erro: 'Resposta inesperada do Gov.br',
      raw: resBody.substring(0, 500),
    })

  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ erro: 'Timeout: webservice do Gov.br não respondeu em 30s. Tente novamente.' })
    }
    console.error('[transmitir-esocial]', err)
    return res.status(500).json({ erro: 'Erro na transmissão. Verifique o certificado e tente novamente.' })
  }
}
