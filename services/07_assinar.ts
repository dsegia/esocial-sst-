import forge from 'node-forge'
import { SignedXml } from 'xml-crypto'

export function carregarCertificado(pfxBuffer: Buffer, senha: string) {
  try {
    const pfxDer = forge.util.createBuffer(pfxBuffer.toString('binary'))
    const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfxDer), senha)

    const bags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const keyBag = bags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })
    const certBag = certBags[forge.pki.oids.certBag]?.[0]

    if (!keyBag?.key || !certBag?.cert) {
      throw new Error('Certificado inválido ou senha incorreta.')
    }

    return {
      chavePrivada: keyBag.key,
      certificado: certBag.cert,
      privateKeyPem: forge.pki.privateKeyToPem(keyBag.key as forge.pki.rsa.PrivateKey),
      certPem: forge.pki.certificateToPem(certBag.cert),
      nomeResponsavel: certBag.cert.subject.getField('CN')?.value || '',
      cnpj: certBag.cert.subject.getField('2.16.76.1.3.3')?.value || '',
      validoAte: certBag.cert.validity.notAfter,
    }
  } catch {
    throw new Error('Falha ao carregar o certificado. Verifique a senha e o arquivo .pfx.')
  }
}

export function verificarValidade(cert: ReturnType<typeof carregarCertificado>) {
  const hoje = new Date()
  if (cert.validoAte < hoje) {
    throw new Error(`Certificado vencido em ${cert.validoAte.toLocaleDateString('pt-BR')}. Renove o certificado.`)
  }
  const diasRestantes = Math.round((cert.validoAte.getTime() - hoje.getTime()) / 86400000)
  return { valido: true, diasRestantes }
}

export function assinarXML(xmlString: string, privateKeyPem: string, certPem: string): string {
  const idMatch = xmlString.match(/Id="([^"]+)"/)
  if (!idMatch) throw new Error('XML não contém atributo Id no elemento raiz.')
  const refId = idMatch[1]

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  })

  sig.addReference({
    xpath: `//*[@Id="${refId}"]`,
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    uri: `#${refId}`,
  })

  sig.computeSignature(xmlString)
  return sig.getSignedXml()
}

export function assinarEvento(xmlString: string, pfxBuffer: Buffer, senha: string): string {
  const cert = carregarCertificado(pfxBuffer, senha)
  verificarValidade(cert)
  return assinarXML(xmlString, cert.privateKeyPem, cert.certPem)
}
