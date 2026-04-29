import https from 'https'
import { supabase } from '../lib/supabase'
import { atualizarTransmissao } from './09_sst'

// ─── CONFIGURAÇÃO ────────────────────────────────────────
const ESOCIAL_URL = {
  producao_restrita: 'https://restrito.esocial.gov.br/services/rest',
  producao:          'https://esocial.gov.br/services/rest',
}

export type AmbienteESocial = 'producao_restrita' | 'producao'

// ─── ENVIAR LOTE AO GOV.BR ───────────────────────────────
// Em produção real, o XML precisa estar assinado com ICP-Brasil
// antes de chamar esta função (ver assinar.ts)
export async function enviarLote(params: {
  transmissaoId: string
  empresaId: string
  cnpj: string
  xmlAssinado: string
  ambiente: AmbienteESocial
}): Promise<{ sucesso: boolean; recibo?: string; erro?: string }> {
  const { transmissaoId, empresaId, cnpj, xmlAssinado, ambiente } = params

  // Monta o envelope SOAP
  const soap = montarEnvelopeSOAP(cnpj, xmlAssinado)

  try {
    const resposta = await chamarWebservice(soap, ambiente)
    const recibo = extrairRecibo(resposta)
    const erroGov = extrairErro(resposta)

    if (recibo) {
      // Sucesso — atualiza a transmissão no banco
      await atualizarTransmissao(transmissaoId, {
        status: 'enviado',
        recibo,
        resposta_govbr: { raw: resposta },
        dt_envio: new Date().toISOString(),
        tentativas: 1,
      })
      return { sucesso: true, recibo }
    } else {
      // Rejeição
      await atualizarTransmissao(transmissaoId, {
        status: 'rejeitado',
        erro_codigo: erroGov?.codigo || 'UNKNOWN',
        erro_descricao: erroGov?.descricao || 'Erro não identificado',
        resposta_govbr: { raw: resposta },
        dt_envio: new Date().toISOString(),
      })
      return { sucesso: false, erro: erroGov?.descricao || 'Rejeitado pelo Gov.br' }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro de conexão'
    await atualizarTransmissao(transmissaoId, {
      status: 'rejeitado',
      erro_codigo: 'CONNECTION_ERROR',
      erro_descricao: msg,
    })
    return { sucesso: false, erro: msg }
  }
}

// ─── MONTAR ENVELOPE SOAP ────────────────────────────────
function montarEnvelopeSOAP(cnpj: string, xmlEvento: string): string {
  const cnpjRaw = cnpj.replace(/\D/g, '')
  const timestamp = new Date().toISOString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ser="http://servicos.esocial.gov.br/servicos/empregador/lote/eventos/envio/sincrono/v1_1_0">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:EnviarLoteEventos>
      <ser:loteEventos>
        <eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1">
          <envioLoteEventos grupo="1">
            <ideEmpregador>
              <tpInsc>1</tpInsc>
              <nrInsc>${cnpjRaw}</nrInsc>
            </ideEmpregador>
            <ideTransmissor>
              <nrCPFTrans>${cnpjRaw.substring(0, 11)}</nrCPFTrans>
            </ideTransmissor>
            <eventos>
              <evento Id="evt001">
                ${xmlEvento}
              </evento>
            </eventos>
          </envioLoteEventos>
        </eSocial>
      </ser:loteEventos>
    </ser:EnviarLoteEventos>
  </soapenv:Body>
</soapenv:Envelope>`
}

// ─── CHAMADA HTTP AO WEBSERVICE ──────────────────────────
function chamarWebservice(soap: string, ambiente: AmbienteESocial): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(ESOCIAL_URL[ambiente] + '/WsSST.svc')
    const body = Buffer.from(soap, 'utf-8')

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': body.length,
        'SOAPAction': '"EnviarLoteEventos"',
      },
      // Em produção: adicionar certificado mTLS aqui
      // key: fs.readFileSync('cert.key'),
      // cert: fs.readFileSync('cert.pem'),
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ─── EXTRAIR RECIBO DA RESPOSTA XML ──────────────────────
function extrairRecibo(xml: string): string | null {
  const match = xml.match(/<nrRec>([^<]+)<\/nrRec>/)
  return match ? match[1] : null
}

// ─── EXTRAIR ERRO DA RESPOSTA XML ────────────────────────
function extrairErro(xml: string): { codigo: string; descricao: string } | null {
  const codigoMatch = xml.match(/<codigo>([^<]+)<\/codigo>/)
  const descMatch = xml.match(/<descricao>([^<]+)<\/descricao>/)
  if (codigoMatch || descMatch) {
    return {
      codigo: codigoMatch?.[1] || 'ERR',
      descricao: descMatch?.[1] || 'Erro não identificado pelo Gov.br',
    }
  }
  return null
}

// ─── CONSULTAR SITUAÇÃO DO LOTE ──────────────────────────
export async function consultarLote(nrRec: string, cnpj: string, ambiente: AmbienteESocial) {
  const cnpjRaw = cnpj.replace(/\D/g, '')
  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ser="http://servicos.esocial.gov.br/servicos/empregador/lote/eventos/consulta/retornoProcessamento/v1_0_0">
  <soapenv:Body>
    <ser:ConsultarLoteEventos>
      <ser:consulta>
        <eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/consulta/v1_0_1">
          <consultaLoteEventos>
            <ideEmpregador>
              <tpInsc>1</tpInsc>
              <nrInsc>${cnpjRaw}</nrInsc>
            </ideEmpregador>
            <nrRec>${nrRec}</nrRec>
          </consultaLoteEventos>
        </eSocial>
      </ser:consulta>
    </ser:ConsultarLoteEventos>
  </soapenv:Body>
</soapenv:Envelope>`

  const resposta = await chamarWebservice(soap, ambiente)
  return resposta
}
