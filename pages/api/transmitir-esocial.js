// pages/api/transmitir-esocial.js
// Transmite eventos assinados ao webservice SOAP do eSocial

const ENDPOINTS = {
  producao_restrita: 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/envioLoteEventos/enviarLoteEventos/v1_1_0/index.php',
  producao:          'https://webservices.esocial.gov.br/servicos/empregador/envioLoteEventos/enviarLoteEventos/v1_1_0/index.php',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const { xml_assinado, cnpj_empregador, ambiente = 'producao_restrita', transmissao_id } = req.body

  if (!xml_assinado || !cnpj_empregador) {
    return res.status(400).json({ erro: 'XML assinado e CNPJ são obrigatórios' })
  }

  const endpoint = ENDPOINTS[ambiente]
  if (!endpoint) return res.status(400).json({ erro: 'Ambiente inválido' })

  try {
    // Montar envelope SOAP conforme especificação eSocial
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

    // Enviar ao webservice eSocial
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '"enviarLoteEventos"',
      },
      body: soapEnvelope,
      // Timeout de 30 segundos
      signal: AbortSignal.timeout(30000),
    })

    const resBody = await response.text()

    // Parsear resposta SOAP
    const recibo = resBody.match(/<nrRec>([^<]+)<\/nrRec>/)?.[1]
    const cdResp = resBody.match(/<cdResp>([^<]+)<\/cdResp>/)?.[1]
    const descResp = resBody.match(/<descResp>([^<]+)<\/descResp>/)?.[1]
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

    // Verificar erros na resposta
    if (cdResp && parseInt(cdResp) > 0) {
      return res.status(422).json({
        sucesso: false,
        codigo: cdResp,
        descricao: descResp,
        ocorrencias,
        xml_resposta: resBody.substring(0, 1000),
      })
    }

    // Resposta inesperada
    return res.status(500).json({
      sucesso: false,
      erro: 'Resposta inesperada do Gov.br',
      raw: resBody.substring(0, 500),
    })

  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ erro: 'Timeout: webservice do Gov.br não respondeu em 30s. Tente novamente.' })
    }
    return res.status(500).json({ erro: 'Erro na transmissão: ' + err.message })
  }
}
