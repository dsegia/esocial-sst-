import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import Anthropic from '@anthropic-ai/sdk'

// ─── CLIENTE R2 (Cloudflare) ─────────────────────────────
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET!

// ─── CLIENTE CLAUDE ──────────────────────────────────────
const claude = new Anthropic()

// ─── TIPOS ───────────────────────────────────────────────
export type TipoDocumento = 'aso' | 'ltcat' | 'cat'

export type DadosExtraidosASO = {
  nome: string | null
  cpf: string | null
  data_nasc: string | null
  data_adm: string | null
  matricula: string | null
  funcao: string | null
  setor: string | null
  tipo_aso: string | null
  data_exame: string | null
  prox_exame: string | null
  conclusao: string | null
  medico_nome: string | null
  medico_crm: string | null
  exames: Array<{ nome: string; resultado: string }>
  riscos: string[]
  confianca: Record<string, number>
}

export type DadosExtraidosLTCAT = {
  data_emissao: string | null
  data_vigencia: string | null
  prox_revisao: string | null
  resp_nome: string | null
  resp_conselho: string | null
  resp_registro: string | null
  ghes: Array<{
    nome: string
    setor: string
    qtd_trabalhadores: number
    aposentadoria_especial: boolean
    agentes: Array<{ tipo: string; nome: string; valor: string; limite: string; supera_lt: boolean }>
    epc: Array<{ nome: string; eficaz: boolean }>
    epi: Array<{ nome: string; ca: string; eficaz: boolean }>
  }>
  confianca: Record<string, number>
}

// ─── UPLOAD DO PDF AO R2 ─────────────────────────────────
export async function uploadPDF(
  empresaId: string,
  funcId: string | null,
  tipo: TipoDocumento,
  arquivo: Buffer,
  nomeArquivo: string
): Promise<string> {
  const pasta = funcId
    ? `funcionarios/${empresaId}/${funcId}/${tipo}s/${nomeArquivo}`
    : `empresas/${empresaId}/${tipo}s/${nomeArquivo}`

  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: pasta,
    Body: arquivo,
    ContentType: 'application/pdf',
    // Metadados para auditoria
    Metadata: {
      empresa_id: empresaId,
      func_id: funcId || '',
      tipo_doc: tipo,
      uploaded_at: new Date().toISOString(),
    },
  }))

  return pasta
}

// ─── URL ASSINADA (acesso temporário ao PDF) ──────────────
export async function gerarURLAssinada(path: string, expiracaoSegundos = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: path })
  return getSignedUrl(r2, command, { expiresIn: expiracaoSegundos })
}

// ─── CONVERTER PDF PARA IMAGENS BASE64 ───────────────────
// Usa pdf.js no frontend — aqui recebemos as páginas já convertidas
export async function extrairDadosPDF(
  tipo: TipoDocumento,
  paginasBase64: string[]  // cada item = uma página em base64 (jpeg)
): Promise<DadosExtraidosASO | DadosExtraidosLTCAT> {
  const prompts: Record<TipoDocumento, string> = {
    aso: `Você está analisando um Atestado de Saúde Ocupacional (ASO) brasileiro.
Extraia TODOS os campos encontrados e retorne SOMENTE um JSON válido (sem markdown, sem explicação):
{
  "nome": "nome completo do trabalhador",
  "cpf": "CPF no formato 000.000.000-00",
  "data_nasc": "DD/MM/AAAA",
  "data_adm": "DD/MM/AAAA",
  "matricula": "matrícula ou null",
  "funcao": "função e CBO ou null",
  "setor": "setor/GHE ou null",
  "tipo_aso": "admissional|periodico|retorno|mudanca|demissional|monitoracao",
  "data_exame": "DD/MM/AAAA",
  "prox_exame": "DD/MM/AAAA ou null",
  "conclusao": "apto|inapto|apto_restricao",
  "medico_nome": "nome do médico ou null",
  "medico_crm": "CRM ou null",
  "exames": [{"nome": "nome do exame", "resultado": "Normal|Alterado|Pendente"}],
  "riscos": ["risco 1", "risco 2"],
  "confianca": {
    "nome": 95,
    "cpf": 90,
    "tipo_aso": 85
  }
}
Para cada campo numérico em "confianca", use 0-100.
Se um campo não for encontrado, use null. Retorne APENAS o JSON.`,

    ltcat: `Você está analisando um LTCAT (Laudo Técnico das Condições Ambientais do Trabalho) brasileiro.
Extraia os dados e retorne SOMENTE um JSON válido:
{
  "data_emissao": "DD/MM/AAAA",
  "data_vigencia": "DD/MM/AAAA",
  "prox_revisao": "DD/MM/AAAA ou null",
  "resp_nome": "nome do responsável técnico",
  "resp_conselho": "CREA|CRQ|CRM|null",
  "resp_registro": "número do registro ou null",
  "ghes": [{
    "nome": "nome do GHE",
    "setor": "setor",
    "qtd_trabalhadores": 0,
    "aposentadoria_especial": false,
    "agentes": [{"tipo": "fis|qui|bio|erg", "nome": "nome", "valor": "medição", "limite": "LT", "supera_lt": false}],
    "epc": [{"nome": "nome do EPC", "eficaz": true}],
    "epi": [{"nome": "nome do EPI", "ca": "número CA", "eficaz": true}]
  }],
  "confianca": {"data_emissao": 90, "resp_nome": 95}
}
Retorne APENAS o JSON.`,

    cat: `Você está analisando uma CAT (Comunicação de Acidente de Trabalho).
Extraia os dados e retorne SOMENTE JSON. Não inclua markdown.`,
  }

  // Monta o conteúdo com todas as páginas
  const content: Anthropic.MessageParam['content'] = [
    ...paginasBase64.map((b64, i) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: b64,
      },
    })),
    { type: 'text' as const, text: prompts[tipo] },
  ]

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content }],
  })

  const texto = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

  // Remove markdown se Claude incluir
  const jsonLimpo = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(jsonLimpo)
  } catch {
    throw new Error('Claude retornou resposta inválida. Tente novamente com um PDF mais legível.')
  }
}

// ─── DETECTAR SE PDF É DIGITALIZADO (tem texto ou é imagem) ──
export async function detectarTipoPDF(arquivo: Buffer): Promise<'digital' | 'digitalizado'> {
  // Verifica se há texto extraível no PDF buscando streams de texto
  const conteudo = arquivo.toString('binary')
  const temTexto = /BT[\s\S]{1,500}ET/.test(conteudo) && /Tj|TJ|Tf/.test(conteudo)
  return temTexto ? 'digital' : 'digitalizado'
}

// ─── UPLOAD DO XML ASSINADO ──────────────────────────────
export async function uploadXML(
  empresaId: string,
  transmissaoId: string,
  evento: string,
  xmlBuffer: Buffer
): Promise<string> {
  const path = `transmissoes/${transmissaoId}/${evento}_assinado_${Date.now()}.xml`

  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: path,
    Body: xmlBuffer,
    ContentType: 'application/xml',
    Metadata: {
      empresa_id: empresaId,
      transmissao_id: transmissaoId,
      evento,
      enviado_em: new Date().toISOString(),
    },
  }))

  return path
}
