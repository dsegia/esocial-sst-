import forge from 'node-forge'

// ─── CARREGAR CERTIFICADO A1 (.pfx) ─────────────────────
export function carregarCertificado(pfxBuffer: Buffer, senha: string) {
  try {
    const pfxDer = forge.util.createBuffer(pfxBuffer.toString('binary'))
    const pfx = forge.pkcs12.pkcs12FromAsn1(
      forge.asn1.fromDer(pfxDer),
      senha
    )

    // Extrai chave privada e certificado
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
      nomeResponsavel: certBag.cert.subject.getField('CN')?.value || '',
      cnpj: certBag.cert.subject.getField('2.16.76.1.3.3')?.value || '',
      validoAte: certBag.cert.validity.notAfter,
    }
  } catch {
    throw new Error('Falha ao carregar o certificado. Verifique a senha e o arquivo .pfx.')
  }
}

// ─── VERIFICAR VALIDADE DO CERTIFICADO ───────────────────
export function verificarValidade(cert: ReturnType<typeof carregarCertificado>) {
  const hoje = new Date()
  if (cert.validoAte < hoje) {
    throw new Error(`Certificado vencido em ${cert.validoAte.toLocaleDateString('pt-BR')}. Renove o certificado.`)
  }
  const diasRestantes = Math.round((cert.validoAte.getTime() - hoje.getTime()) / 86400000)
  return { valido: true, diasRestantes }
}

// ─── ASSINAR XML COM XMLDSIG (padrão ICP-Brasil) ─────────
// O eSocial exige assinatura envelopada (enveloped) com SHA-256 + RSA
export function assinarXML(
  xmlString: string,
  chavePrivada: forge.pki.PrivateKey,
  certificado: forge.pki.Certificate
): string {
  // 1. Localiza o Id do elemento raiz para referenciar na assinatura
  const idMatch = xmlString.match(/Id="([^"]+)"/)
  if (!idMatch) throw new Error('XML não contém atributo Id no elemento raiz.')
  const refId = idMatch[1]

  // 2. Canonicaliza o XML (C14N)
  // Em produção usar uma lib específica de XML Canonicalization
  // Aqui fazemos uma simplificação — para produção real usar:
  // npm install xml-crypto   (mais completo para xmldsig)
  const xmlCanon = xmlString.trim()

  // 3. Digest SHA-256 do XML canonicalizado
  const md = forge.md.sha256.create()
  md.update(forge.util.encodeUtf8(xmlCanon))
  const digestValue = forge.util.encode64(md.digest().bytes())

  // 4. Monta o SignedInfo
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
  <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
  <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
  <Reference URI="#${refId}">
    <Transforms>
      <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
      <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    </Transforms>
    <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
    <DigestValue>${digestValue}</DigestValue>
  </Reference>
</SignedInfo>`

  // 5. Assina o SignedInfo com RSA-SHA256
  const mdSig = forge.md.sha256.create()
  mdSig.update(forge.util.encodeUtf8(signedInfo))
  const privateKey = chavePrivada as forge.pki.rsa.PrivateKey
  const signatureBytes = privateKey.sign(mdSig)
  const signatureValue = forge.util.encode64(signatureBytes)

  // 6. Certificado em Base64
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificado))
  const certBase64 = forge.util.encode64(certDer.bytes())

  // 7. Bloco de assinatura completo
  const signature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
  ${signedInfo}
  <SignatureValue>${signatureValue}</SignatureValue>
  <KeyInfo>
    <X509Data>
      <X509Certificate>${certBase64}</X509Certificate>
    </X509Data>
  </KeyInfo>
</Signature>`

  // 8. Insere a assinatura antes do fechamento do elemento raiz
  const tagFechaMatch = xmlString.match(/<\/([a-zA-Z:]+)>\s*$/)
  if (!tagFechaMatch) throw new Error('Não foi possível localizar a tag de fechamento do XML.')

  return xmlString.replace(
    new RegExp(`</${tagFechaMatch[1]}>\\s*$`),
    `${signature}\n</${tagFechaMatch[1]}>`
  )
}

// ─── PIPELINE COMPLETO: XML → ASSINADO ───────────────────
export function assinarEvento(
  xmlString: string,
  pfxBuffer: Buffer,
  senha: string
): string {
  const cert = carregarCertificado(pfxBuffer, senha)
  verificarValidade(cert)
  return assinarXML(xmlString, cert.chavePrivada, cert.certificado)
}
