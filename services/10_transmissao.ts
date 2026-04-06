import { gerarXML_S2220, gerarXML_S2240, gerarXML_S2210, validarDadosS2220, validarDadosS2210 } from './xml-generator'
import { assinarEvento } from './assinar'
import { uploadXML } from './storage'
import { enviarLote, type AmbienteESocial } from './govbr'
import { salvarTransmissao, atualizarTransmissao } from './sst'
import type { ASO, LTCAT, CAT, Funcionario, Empresa } from '../types/database'

export type ResultadoTransmissao = {
  sucesso: boolean
  transmissaoId: string
  recibo?: string
  erro?: string
  xmlGerado?: string
}

// ─── S-2220: ASO ─────────────────────────────────────────
export async function transmitirS2220(params: {
  aso: ASO
  funcionario: Funcionario
  empresa: Empresa
  pfxBuffer: Buffer
  certSenha: string
  ambiente: AmbienteESocial
  loteId?: string
}): Promise<ResultadoTransmissao> {
  const { aso, funcionario, empresa, pfxBuffer, certSenha, ambiente, loteId } = params

  // 1. Validar
  const erros = validarDadosS2220(aso, funcionario)
  if (erros.length > 0) throw new Error('Dados inválidos: ' + erros.join(', '))

  // 2. Registrar transmissão como pendente
  const tx = await salvarTransmissao({
    empresa_id: empresa.id,
    funcionario_id: funcionario.id,
    evento: 'S-2220',
    referencia_id: aso.id,
    referencia_tipo: 'aso',
    status: 'pendente',
    lote_id: loteId || null,
    ambiente,
    tentativas: 0,
    recibo: null,
    xml_path: null,
    resposta_govbr: null,
    erro_codigo: null,
    erro_descricao: null,
    dt_envio: null,
  })

  // 3. Gerar XML
  const xml = gerarXML_S2220(aso, funcionario, empresa)

  // 4. Assinar com certificado A1
  const xmlAssinado = assinarEvento(xml, pfxBuffer, certSenha)

  // 5. Salvar XML no R2
  const xmlPath = await uploadXML(empresa.id, tx.id, 'S-2220', Buffer.from(xmlAssinado, 'utf-8'))
  await atualizarTransmissao(tx.id, { xml_path: xmlPath })

  // 6. Enviar ao Gov.br
  const resultado = await enviarLote({
    transmissaoId: tx.id,
    empresaId: empresa.id,
    cnpj: empresa.cnpj,
    xmlAssinado,
    ambiente,
  })

  return { ...resultado, transmissaoId: tx.id, xmlGerado: xml }
}

// ─── S-2240: LTCAT ───────────────────────────────────────
export async function transmitirS2240(params: {
  ltcat: LTCAT
  funcionario: Funcionario
  empresa: Empresa
  pfxBuffer: Buffer
  certSenha: string
  ambiente: AmbienteESocial
  loteId?: string
}): Promise<ResultadoTransmissao> {
  const { ltcat, funcionario, empresa, pfxBuffer, certSenha, ambiente, loteId } = params

  const tx = await salvarTransmissao({
    empresa_id: empresa.id,
    funcionario_id: funcionario.id,
    evento: 'S-2240',
    referencia_id: ltcat.id,
    referencia_tipo: 'ltcat',
    status: 'pendente',
    lote_id: loteId || null,
    ambiente,
    tentativas: 0,
    recibo: null, xml_path: null, resposta_govbr: null,
    erro_codigo: null, erro_descricao: null, dt_envio: null,
  })

  const xml = gerarXML_S2240(ltcat, funcionario, empresa)
  const xmlAssinado = assinarEvento(xml, pfxBuffer, certSenha)
  const xmlPath = await uploadXML(empresa.id, tx.id, 'S-2240', Buffer.from(xmlAssinado, 'utf-8'))
  await atualizarTransmissao(tx.id, { xml_path: xmlPath })

  const resultado = await enviarLote({
    transmissaoId: tx.id,
    empresaId: empresa.id,
    cnpj: empresa.cnpj,
    xmlAssinado,
    ambiente,
  })

  return { ...resultado, transmissaoId: tx.id, xmlGerado: xml }
}

// ─── S-2210: CAT ─────────────────────────────────────────
export async function transmitirS2210(params: {
  cat: CAT
  funcionario: Funcionario
  empresa: Empresa
  pfxBuffer: Buffer
  certSenha: string
  ambiente: AmbienteESocial
}): Promise<ResultadoTransmissao> {
  const { cat, funcionario, empresa, pfxBuffer, certSenha, ambiente } = params

  const erros = validarDadosS2210(cat, funcionario)
  if (erros.length > 0) throw new Error('Dados inválidos: ' + erros.join(', '))

  const tx = await salvarTransmissao({
    empresa_id: empresa.id,
    funcionario_id: funcionario.id,
    evento: 'S-2210',
    referencia_id: cat.id,
    referencia_tipo: 'cat',
    status: 'pendente',
    lote_id: null,
    ambiente,
    tentativas: 0,
    recibo: null, xml_path: null, resposta_govbr: null,
    erro_codigo: null, erro_descricao: null, dt_envio: null,
  })

  const xml = gerarXML_S2210(cat, funcionario, empresa)
  const xmlAssinado = assinarEvento(xml, pfxBuffer, certSenha)
  const xmlPath = await uploadXML(empresa.id, tx.id, 'S-2210', Buffer.from(xmlAssinado, 'utf-8'))
  await atualizarTransmissao(tx.id, { xml_path: xmlPath })

  const resultado = await enviarLote({
    transmissaoId: tx.id,
    empresaId: empresa.id,
    cnpj: empresa.cnpj,
    xmlAssinado,
    ambiente,
  })

  return { ...resultado, transmissaoId: tx.id, xmlGerado: xml }
}

// ─── LOTE SIMULTÂNEO S-2220 + S-2240 ────────────────────
export async function transmitirLoteS2220eS2240(params: {
  aso: ASO
  ltcat: LTCAT
  funcionario: Funcionario
  empresa: Empresa
  pfxBuffer: Buffer
  certSenha: string
  ambiente: AmbienteESocial
}): Promise<{ s2240: ResultadoTransmissao; s2220: ResultadoTransmissao }> {
  // Gera um lote_id compartilhado
  const loteId = crypto.randomUUID()

  // S-2240 primeiro (requisito do Gov.br — condições antes do monitoramento)
  const s2240 = await transmitirS2240({ ...params, loteId })

  // S-2220 na sequência
  const s2220 = await transmitirS2220({ ...params, loteId })

  return { s2240, s2220 }
}
