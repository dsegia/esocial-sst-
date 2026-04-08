// pages/api/ler-certificado.js
// Lê metadados do certificado .pfx sem armazenar a chave privada

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const { pfx, senha } = req.body
  if (!pfx || !senha) return res.status(400).json({ erro: 'Arquivo e senha obrigatórios' })

  try {
    // Usa forge para ler o certificado (instalar: npm install node-forge)
    const forge = require('node-forge')
    const pfxBuffer = Buffer.from(pfx, 'base64')
    const pfxDer = forge.util.createBuffer(pfxBuffer.toString('binary'))
    const pfxAsn1 = forge.asn1.fromDer(pfxDer)

    let p12
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, senha)
    } catch (err) {
      return res.status(400).json({ erro: 'Senha incorreta ou arquivo inválido.' })
    }

    // Extrair certificado
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const certBags = bags[forge.pki.oids.certBag]
    if (!certBags || certBags.length === 0) {
      return res.status(400).json({ erro: 'Nenhum certificado encontrado no arquivo.' })
    }

    const cert = certBags[0].cert
    const subject = cert.subject.attributes.reduce((acc, attr) => {
      acc[attr.shortName] = attr.value; return acc
    }, {})

    const validade = cert.validity.notAfter
    const agora = new Date()
    const diasRestantes = Math.round((validade - agora) / 86400000)

    const info = {
      titular: subject.CN || subject.O || 'Não identificado',
      cnpj: subject.CN?.match(/\d{14}/)?.[0] || null,
      validade: validade.toISOString().split('T')[0],
      dias_restantes: diasRestantes,
      tipo: 'A1',
      emissor: cert.issuer.attributes.find(a => a.shortName === 'O')?.value || 'AC ICP-Brasil',
      vencido: diasRestantes < 0,
    }

    return res.status(200).json({ sucesso: true, info })

  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao processar certificado: ' + err.message })
  }
}
