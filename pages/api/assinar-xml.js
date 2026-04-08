// pages/api/assinar-xml.js
// Assina XML com XMLDSig ICP-Brasil usando certificado A1
// O .pfx e a senha NUNCA são armazenados — usados apenas em memória

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const { xml, pfx, senha, tagAssinatura } = req.body
  // tagAssinatura = elemento que será referenciado na assinatura (ex: 'evtMonit', 'evtExpRisco', 'evtCAT')

  if (!xml || !pfx || !senha) {
    return res.status(400).json({ erro: 'XML, certificado e senha são obrigatórios' })
  }

  try {
    const forge = require('node-forge')

    // 1. Carregar o certificado .pfx
    const pfxBuf = Buffer.from(pfx, 'base64')
    const pfxDer = forge.util.createBuffer(pfxBuf.toString('binary'))
    const pfxAsn1 = forge.asn1.fromDer(pfxDer)

    let p12
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, senha)
    } catch {
      return res.status(400).json({ erro: 'Senha do certificado incorreta.' })
    }

    // Extrair chave privada
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    if (!keyBag) return res.status(400).json({ erro: 'Chave privada não encontrada no certificado.' })
    const privateKey = keyBag.key

    // Extrair certificado público
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const certBag = certBags[forge.pki.oids.certBag]?.[0]
    if (!certBag) return res.status(400).json({ erro: 'Certificado público não encontrado.' })
    const cert = certBag.cert

    // Verificar validade
    const agora = new Date()
    if (agora > cert.validity.notAfter) {
      return res.status(400).json({ erro: 'Certificado vencido em ' + cert.validity.notAfter.toLocaleDateString('pt-BR') })
    }

    // 2. Identificar o ID do elemento a assinar
    const idMatch = xml.match(/Id="([^"]+)"/)
    const elemId = idMatch ? idMatch[1] : 'signed-element'

    // 3. Canonicalização C14N do XML (simplificada para ICP-Brasil)
    // Remove espaços extras e normaliza o XML
    const xmlLimpo = xml
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')

    // 4. Calcular digest SHA-1 do XML canonicalizado
    const md = forge.md.sha1.create()
    md.update(forge.util.encodeUtf8(xmlLimpo))
    const digestB64 = forge.util.encode64(md.digest().getBytes())

    // 5. Construir o SignedInfo
    const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
      `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
      `<Reference URI="#${elemId}">` +
        `<Transforms>` +
          `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
          `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
        `</Transforms>` +
        `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
        `<DigestValue>${digestB64}</DigestValue>` +
      `</Reference>` +
    `</SignedInfo>`

    // 6. Assinar o SignedInfo com RSA-SHA1
    const mdSig = forge.md.sha1.create()
    mdSig.update(forge.util.encodeUtf8(signedInfo))
    const signatureBytes = privateKey.sign(mdSig)
    const signatureB64 = forge.util.encode64(signatureBytes)

    // 7. Certificado em base64 para KeyInfo
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
    const certB64 = forge.util.encode64(certDer)

    // 8. Bloco Signature completo
    const signatureBlock = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      signedInfo +
      `<SignatureValue>${signatureB64}</SignatureValue>` +
      `<KeyInfo>` +
        `<X509Data>` +
          `<X509Certificate>${certB64}</X509Certificate>` +
        `</X509Data>` +
      `</KeyInfo>` +
    `</Signature>`

    // 9. Inserir assinatura antes do fechamento do elemento raiz
    const tag = tagAssinatura || 'eSocial'
    const xmlAssinado = xmlLimpo.replace(`</${tag}>`, `${signatureBlock}</${tag}>`)

    return res.status(200).json({
      sucesso: true,
      xml_assinado: xmlAssinado,
      titular: cert.subject.attributes.find(a => a.shortName === 'CN')?.value,
      validade: cert.validity.notAfter.toISOString().split('T')[0],
    })

  } catch (err) {
    return res.status(500).json({ erro: 'Erro na assinatura: ' + err.message })
  }
}
