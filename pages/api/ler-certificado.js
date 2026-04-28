// pages/api/ler-certificado.js
// Lê metadados do .pfx sem armazenar chave privada

import { checkRateLimit, getClientIP } from '../../lib/rate-limit'
import { requireAuth } from '../../lib/auth-middleware'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const user = await requireAuth(req, res)
  if (!user) return

  const ip = getClientIP(req)
  const { limited, retryAfter } = checkRateLimit(ip, { windowMs: 60_000, max: 10 })
  if (limited) return res.status(429).json({ erro: 'Muitas requisições. Tente novamente em breve.', retryAfter })

  const { pfx, senha } = req.body
  if (!pfx || !senha) return res.status(400).json({ erro: 'Arquivo e senha obrigatórios' })

  try {
    const forge = require('node-forge')
    const pfxBuf = Buffer.from(pfx, 'base64')
    const pfxDer = forge.util.createBuffer(pfxBuf.toString('binary'))
    const pfxAsn1 = forge.asn1.fromDer(pfxDer)

    let p12
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, senha)
    } catch {
      return res.status(400).json({ erro: 'Senha incorreta ou arquivo inválido.' })
    }

    const bags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const certBags = bags[forge.pki.oids.certBag]
    if (!certBags?.length) return res.status(400).json({ erro: 'Nenhum certificado encontrado.' })

    const cert = certBags[0].cert
    const getAttr = (shortName) => cert.subject.attributes.find(a => a.shortName === shortName)?.value || null

    const validade = cert.validity.notAfter
    const diasRestantes = Math.round((validade - new Date()) / 86400000)

    // Extrair CNPJ do CN (formato: NOME:CNPJ ou apenas CNPJ)
    const cn = getAttr('CN') || ''
    const cnpjMatch = cn.match(/\d{14}/) || cn.replace(/\D/g,'').match(/\d{14}/)
    const cnpj = cnpjMatch ? cnpjMatch[0] : null

    return res.status(200).json({
      sucesso: true,
      info: {
        titular: getAttr('CN') || getAttr('O') || 'Não identificado',
        cnpj,
        organizacao: getAttr('O'),
        validade: validade.toISOString().split('T')[0],
        dias_restantes: diasRestantes,
        tipo: 'A1',
        emissor: cert.issuer.attributes.find(a => a.shortName === 'O')?.value || 'AC ICP-Brasil',
        vencido: diasRestantes < 0,
        serial: cert.serialNumber,
      }
    })
  } catch (err) {
    console.error('[ler-certificado]', err)
    return res.status(500).json({ erro: 'Erro ao processar certificado. Verifique se o arquivo e a senha estão corretos.' })
  }
}
