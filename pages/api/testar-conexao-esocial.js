// pages/api/testar-conexao-esocial.js
// Testa conectividade com o webservice eSocial Gov.br
// Envia SOAP mínimo sem certificado — eSocial responde com erro de autenticação,
// o que confirma que a conexão está funcionando.

import { checkRateLimit, getClientIP } from '../../lib/rate-limit'
import { requireAuth } from '../../lib/auth-middleware'

const ENDPOINTS = {
  producao_restrita: 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/envioLoteEventos/enviarLoteEventos/v1_1_0/index.php',
  producao: 'https://webservices.esocial.gov.br/servicos/empregador/envioLoteEventos/enviarLoteEventos/v1_1_0/index.php',
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' })
  }

  const user = await requireAuth(req, res)
  if (!user) return

  const ip = getClientIP(req)
  const { limited, retryAfter } = checkRateLimit(ip, { windowMs: 60_000, max: 5 })
  if (limited) return res.status(429).json({ erro: 'Muitas requisições. Tente novamente em breve.', retryAfter })

  const ambiente = req.query.ambiente || 'producao_restrita'
  const endpoint = ENDPOINTS[ambiente]
  if (!endpoint) return res.status(400).json({ erro: 'Ambiente inválido' })

  const inicio = Date.now()

  // SOAP envelope mínimo — sem assinatura válida
  // O Gov.br deve responder com SOAP Fault de autenticação,
  // o que confirma que a conexão está ativa.
  const soapMinimo = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:v1="http://www.esocial.gov.br/servicos/empregador/envioLoteEventos/enviarLoteEventos/v1_1_0">
  <soapenv:Header/>
  <soapenv:Body>
    <v1:EnviarLoteEventosRequest>
      <loteEventos>
        <eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1">
          <envioLoteEventos grupo="1">
            <ideEmpregador><tpInsc>1</tpInsc><nrInsc>00000000</nrInsc></ideEmpregador>
            <ideTransmissor><tpInsc>1</tpInsc><nrInsc>00000000000000</nrInsc></ideTransmissor>
            <eventos/>
          </envioLoteEventos>
        </eSocial>
      </loteEventos>
    </v1:EnviarLoteEventosRequest>
  </soapenv:Body>
</soapenv:Envelope>`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '"enviarLoteEventos"',
      },
      body: soapMinimo,
      signal: AbortSignal.timeout(15000),
    })

    const latencia = Date.now() - inicio
    const body = await response.text()

    // Qualquer resposta HTTP (mesmo SOAP Fault) = conexão OK
    const ehSoapFault = body.includes('Fault') || body.includes('fault')
    const ehRespostaEsocial = body.includes('esocial') || body.includes('eSocial') || ehSoapFault
    const cdResp = body.match(/<cdResp>([^<]+)<\/cdResp>/)?.[1]
    const descResp = body.match(/<descResp>([^<]+)<\/descResp>/)?.[1]
    const faultString = body.match(/<faultstring>([^<]+)<\/faultstring>/)?.[1]

    return res.status(200).json({
      conectado: true,
      latencia_ms: latencia,
      http_status: response.status,
      ambiente,
      endpoint,
      resposta_esocial: ehRespostaEsocial,
      codigo: cdResp || null,
      descricao: descResp || faultString || 'Webservice respondeu',
      raw_preview: body.substring(0, 300),
    })

  } catch (err) {
    const latencia = Date.now() - inicio
    if (err.name === 'TimeoutError') {
      return res.status(200).json({
        conectado: false,
        latencia_ms: latencia,
        ambiente,
        endpoint,
        erro: 'Timeout: webservice não respondeu em 15 segundos',
      })
    }
    return res.status(200).json({
      conectado: false,
      latencia_ms: latencia,
      ambiente,
      endpoint,
      erro: 'Falha na conexão com o webservice.',
    })
  }
}
