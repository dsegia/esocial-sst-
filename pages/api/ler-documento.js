// pages/api/ler-documento.js
// Gemini 2.5-flash-lite (1000 req/dia grátis) + Anthropic fallback
// Exames mapeados para Tabela 27, Riscos para Tabela 24

// ─── TABELA 27 — Procedimentos Diagnósticos ───────────
const TABELA27 = {
  'avaliacao clinica':'0001','exame clinico':'0001','anamnese':'0001',
  'avaliacao psicossocial':'0002','psicossocial':'0002',
  'hemograma':'0010','hemograma completo':'0010',
  'glicemia':'0011','glicemia de jejum':'0011','glicemia/ glicose':'0011','glicemia/glicose':'0011',
  'urina':'0012','eas':'0012','urina tipo i':'0012',
  'ureia':'0013','creatinina':'0014','acido urico':'0015',
  'colesterol':'0016','triglicerides':'0017','triglicérides':'0017',
  'tgo':'0018','ast':'0018','tgp':'0019','alt':'0019',
  'gama gt':'0020','gama-gt':'0020',
  'tipagem':'0029','tipagem sanguinea':'0029','abo rh':'0029',
  'audiometria':'0040','audiometria tonal':'0040',
  'acuidade visual':'0050','snellen':'0050','visao':'0050',
  'espirometria':'0060','prova de funcao pulmonar':'0060',
  'rx torax':'0061','rx de torax':'0061','rx torax pa oit':'0061','radiografia torax':'0061',
  'eletroencefalograma':'0070','eeg':'0070',
  'teste de romberg':'0073','romberg':'0073',
  'eletrocardiograma':'0080','ecg':'0080',
  'rx coluna':'0091','coluna lombar':'0091',
  'avaliacao dermatologica':'0100','dermatologica':'0100',
  'hepatite b':'0110','hbsag':'0110',
  'toxicologico':'0120','exame toxicologico':'0120',
}

// ─── TABELA 24 — Agentes Nocivos ──────────────────────
const TABELA24 = {
  'ruido':'01.01.001','ruído':'01.01.001','ruido continuo':'01.01.001','ruido intermitente':'01.01.001','pressao sonora':'01.01.001','nps':'01.01.001',
  'ruido de impacto':'01.01.002','impacto':'01.01.002',
  'calor':'01.02.001','calor excessivo':'01.02.001','ibutg':'01.02.001','temperatura elevada':'01.02.001','estresse termico':'01.02.001',
  'radiacao ionizante':'01.03.001','raio x':'01.03.001','radioatividade':'01.03.001','radiologico':'01.03.001',
  'vibracao corpo':'01.04.001','vibracao de corpo inteiro':'01.04.001',
  'vibracao mao':'01.04.002','vibracao braco':'01.04.002','vibracao maos':'01.04.002',
  'frio':'01.05.001','temperatura fria':'01.05.001','camara fria':'01.05.001','frigorifico':'01.05.001',
  'pressao hiperbarica':'01.06.001','mergulho':'01.06.001',
  'umidade':'01.07.001','umidade excessiva':'01.07.001',
  'arsenio':'02.01.001','arsenico':'02.01.001',
  'amianto':'02.02.001','asbesto':'02.02.001','asbestos':'02.02.001',
  'benzeno':'02.03.001','benzol':'02.03.001','tolueno':'02.03.001','xileno':'02.03.001',
  'chumbo':'02.04.001','plumbemia':'02.04.001',
  'carvao':'02.05.001','carvao mineral':'02.05.001',
  'cromo':'02.06.001','cromio':'02.06.001',
  'fosforo':'02.07.001','organofosforado':'02.07.001',
  'hidrocarboneto':'02.08.001','gasolina':'02.08.001','diesel':'02.08.001','solvente':'02.08.001',
  'manganes':'02.09.001','manganês':'02.09.001',
  'mercurio':'02.10.001','mercúrio':'02.10.001',
  'silica':'02.11.001','silicose':'02.11.001','sio2':'02.11.001','quartzo':'02.11.001',
  'poeira respiravel silica':'02.11.001','poeira total silica':'02.11.001','poeira de cal':'02.11.001',
  'poeira respiravel':'02.11.001','poeira total':'02.11.001',
  'agrotoxico':'02.14.001','pesticida':'02.14.001','herbicida':'02.14.001',
  'gases':'02.18.001','vapores':'02.18.001','gas toxico':'02.18.001','vapores alcalinos':'02.18.001',
  'explosivo':'02.21.001','explosao':'02.21.001',
  'biologico':'03.01.001','virus':'03.01.001','bacteria':'03.01.001','fungo':'03.01.001',
  'esgoto':'03.01.002','lixo':'03.01.002','residuo infectante':'03.01.002',
  'queda':'09.01.001','queda de nivel':'09.01.001','queda de altura':'09.01.001',
  'esforco fisico':'09.01.001','postura':'09.01.001','postura inadequada':'09.01.001',
  'ergonomico':'09.01.001','ergonomia':'09.01.001','esforco repetitivo':'09.01.001',
  'arranjo fisico':'09.01.001','prensamento':'09.01.001',
  'insuficiencia de oxigenio':'09.01.001','oxigenio':'09.01.001',
}

function norm(s) {
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
}

function codigoExame(nome) {
  const n = norm(nome)
  for (const [k,v] of Object.entries(TABELA27)) { if (n.includes(k)) return v }
  return '0200'
}

function codigoAgente(nome) {
  const n = norm(nome)
  for (const [k,v] of Object.entries(TABELA24)) { if (n.includes(k)) return v }
  return '09.01.001'
}

// ── Prompts ──────────────────────────────────────────────
const PROMPT_LTCAT = `Você é especialista em LTCAT brasileiro. Analise o documento COMPLETO e retorne SOMENTE JSON válido, sem texto antes ou depois.

ESTRUTURA TÍPICA DO DOCUMENTO:
- "Data de criação" ou "Data de Emissão" → data_emissao
- "RESPONSABILIDADE TÉCNICA" → resp_nome, resp_conselho (CREA ou CRM), resp_registro (número)
- Tabelas "CÓD. GHE/GF" + "NOMENCLATURA GHE/GF" → cada linha é um GHE separado
- Coluna "FUNÇÃO" dentro de cada GHE → extraia CADA função/cargo individualmente
- Tabela de RISCO com "Código eSocial" → agentes do GHE
- Se o GHE indicar ausência de risco com qualquer expressão ("Inexiste", "Ausência de agente nocivo", "Não há agentes", "Sem exposição", "Não significativo", "Abaixo do LT", "ISENTO", "NÃO HÁ RISCO") → agentes = [] e aposentadoria_especial = false
- Tabela EPI / EPC no final de cada GHE → extraia equipamentos (ignora "--")

REGRAS CRÍTICAS:
1. Datas: converter DD/MM/AAAA para AAAA-MM-DD. Ex: "08/02/2022" → "2022-02-08"
2. "funcoes": CADA cargo separado no array. Se GHE tem 5 funções, o array deve ter 5 itens
3. "agentes": array vazio [] se o documento diz "Inexiste", "Ausência", "Não há", "Sem exposição", "Não significativo", "ISENTO" ou qualquer indicação de ausência de risco
4. "aposentadoria_especial": true APENAS se o laudo confirma direito a aposentadoria especial
5. "epi": array vazio [] se todos os EPIs são "--". Mesmo para epc
6. "resp_conselho": "CREA" se engenheiro, "CRM" se médico do trabalho

{
  "dados_gerais": {
    "data_emissao": "2022-02-08",
    "data_vigencia": null,
    "prox_revisao": null,
    "resp_nome": "Nome Completo do Responsável",
    "resp_conselho": "CREA",
    "resp_registro": "1512311472"
  },
  "ghes": [
    {
      "nome": "GHE 01 - ADMINISTRAÇÃO",
      "setor": "Administrativo",
      "qtd_trabalhadores": 5,
      "aposentadoria_especial": false,
      "funcoes": ["Auxiliar de vendas", "Gerente de Vendas", "Estoquista"],
      "agentes": [],
      "epc": [{"nome": "Extintor pó químico ABC", "eficaz": true}],
      "epi": []
    }
  ],
  "confianca": {"data_emissao": 95, "resp_nome": 95, "ghes": 90}
}`

const PROMPT_PCMSO = `Você é especialista em PCMSO brasileiro (NR-7). Analise o documento COMPLETO e retorne SOMENTE JSON válido.

EXTRAIA:
1. dados_gerais: médico coordenador (nome + CRM), data de elaboração, período de vigência
2. Para CADA função/cargo listada no programa, os exames com periodicidade

REGRAS:
- Datas: converter DD/MM/AAAA para AAAA-MM-DD
- Para cada função, liste TODOS os exames previstos (admissional, periódico, etc.)
- Periodicidade típica: "Anual", "Semestral", "Bienal", "A cada exame"

{
  "dados_gerais": {"medico_nome": null, "medico_crm": null, "data_elaboracao": null, "vigencia": null},
  "programas": [
    {
      "funcao": "Nome da função",
      "setor": null,
      "riscos": ["Risco 1"],
      "exames": [{"nome": "Avaliação clínica", "periodicidade": "Anual", "obrigatorio": true}]
    }
  ],
  "confianca": {"medico": 90, "programas": 85}
}`

const PROMPT_AUTO = `Você é especialista em documentos SST brasileiros. Analise COMPLETAMENTE este PDF e:

PASSO 1 — Identifique o tipo:
- "ltcat" → contém "LTCAT", "Laudo Técnico das Condições Ambientais", GHEs, agentes de risco, responsável técnico CREA/CRM
- "pcmso" → contém "PCMSO", "Programa de Controle Médico", exames ocupacionais por função, médico coordenador
- "aso" → contém "ASO", "Atestado de Saúde Ocupacional", dados de UM funcionário específico, conclusão apto/inapto

PASSO 2 — Extraia os dados completos conforme o tipo:

LTCAT → {"tipo":"ltcat","dados_gerais":{"data_emissao":"AAAA-MM-DD","data_vigencia":null,"prox_revisao":null,"resp_nome":"Nome do engenheiro/médico","resp_conselho":"CREA","resp_registro":"número do CREA/CRM"},"ghes":[{"nome":"GHE 01 - NOME","setor":"nome do setor","qtd_trabalhadores":1,"aposentadoria_especial":false,"funcoes":["Cargo 1","Cargo 2","Cargo 3"],"agentes":[{"tipo":"fis","nome":"Ruído contínuo","valor":null,"limite":null,"supera_lt":false}],"epc":[{"nome":"Extintor","eficaz":true}],"epi":[]}],"confianca":{"data_emissao":95,"resp_nome":95,"ghes":90}}

PCMSO → {"tipo":"pcmso","dados_gerais":{"medico_nome":null,"medico_crm":null,"data_elaboracao":null,"vigencia":null},"programas":[{"funcao":"Nome cargo","setor":null,"riscos":[],"exames":[{"nome":"Avaliação clínica","periodicidade":"Anual","obrigatorio":true}]}],"confianca":{"medico":90,"programas":85}}

ASO → {"tipo":"aso","funcionario":{"nome":null,"cpf":null,"data_nasc":null,"data_adm":null,"matricula":null,"funcao":null,"setor":null},"aso":{"tipo_aso":"periodico","data_exame":null,"prox_exame":null,"conclusao":"apto","medico_nome":null,"medico_crm":null},"exames":[{"nome":"exame","resultado":"Normal"}],"riscos":["risco"],"confianca":{"nome":85,"cpf":85,"tipo_aso":80,"data_exame":90,"conclusao":85}}

REGRAS GERAIS:
- Datas: converter DD/MM/AAAA → AAAA-MM-DD
- Agentes: se o documento indica ausência com qualquer termo ("Inexiste", "Ausência", "Não há", "Sem exposição", "Não significativo", "ISENTO", "Abaixo do LT") → agentes = []
- EPI "--" → epi = []
- Retorne SOMENTE o JSON, sem texto antes ou depois`

// ── Leitor Claude com PDF nativo (primário para LTCAT/PCMSO) ─
async function lerComClaude(pdf_base64, texto_pdf, paginas, tipo, anthropicKey) {
  const prompt = tipo === 'pcmso' ? PROMPT_PCMSO : tipo === 'auto' ? PROMPT_AUTO : PROMPT_LTCAT

  function extrairJSON(str) {
    const ini = str.indexOf('{'); if (ini===-1) return null
    let d=0
    for (let i=ini;i<str.length;i++) { if(str[i]==='{')d++; if(str[i]==='}'){d--;if(d===0)return str.substring(ini,i+1)} }
    return null
  }

  function parseRobusto(texto) {
    const limpo = texto.replace(/\`\`\`json\n?/g,'').replace(/\`\`\`\n?/g,'').trim()
    for (const fn of [
      ()=>JSON.parse(limpo),
      ()=>JSON.parse(extrairJSON(limpo)),
      ()=>JSON.parse(extrairJSON(texto)),
    ]) { try { const r=fn(); if(r) return r } catch {} }
    return null
  }

  try {
    let content = []

    if (pdf_base64) {
      // ── Modo preferencial: PDF nativo (Anthropic document support) ──
      content = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 }
        },
        { type: 'text', text: prompt }
      ]
    } else if (paginas?.length > 0) {
      // Fallback: imagens JPEG
      paginas.forEach(b64 => {
        content.push({ type:'image', source:{ type:'base64', media_type:'image/jpeg', data:b64 } })
      })
      content.push({ type:'text', text: prompt })
    } else {
      // Fallback: texto extraído
      content = [{ type:'text', text: `${prompt}\n\nTEXTO DO DOCUMENTO:\n${texto_pdf.substring(0,25000)}` }]
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25', // habilita suporte nativo a PDF
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', // Sonnet para melhor precisão em documentos complexos
        max_tokens: 8000,
        messages: [{ role: 'user', content }]
      })
    })

    if (!response.ok) throw new Error(await response.text())
    const data = await response.json()
    const texto = data.content?.[0]?.text || ''
    const resultado = parseRobusto(texto)
    if (resultado) {
      const modo = pdf_base64 ? 'pdf-nativo' : paginas?.length > 0 ? 'imagem' : 'texto'
      if (tipo === 'auto' && resultado.tipo) {
        const tipoDetectado = resultado.tipo
        const { tipo: _, ...dadosSemTipo } = resultado
        return { tipo_detectado: tipoDetectado, dados: enriquecer(dadosSemTipo, tipoDetectado), modo, modelo: 'claude-sonnet' }
      }
      return { dados: enriquecer(resultado, tipo), modo, modelo: 'claude-sonnet' }
    }
    throw new Error('JSON inválido na resposta do Claude')
  } catch (err) {
    console.log('Claude falhou (' + err.message.substring(0,100) + '), usando Gemini como fallback')
    return null
  }
}

// ────────────────────────────────────────────────────────
export const config = { api: { bodyParser: { sizeLimit: '20mb' } }, maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const { paginas, texto_pdf, pdf_base64, tipo } = req.body
  const geminiKey    = process.env.GEMINI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!geminiKey && !anthropicKey) return res.status(500).json({ erro: 'Nenhuma API key configurada' })

  // 3 níveis já resolvidos no cliente:
  // - pdf_base64 preenchido  → PDF pequeno, leitura nativa (máxima precisão)
  // - texto_pdf preenchido   → PDF grande com texto, modo prompt
  // - paginas preenchido     → PDF escaneado, modo imagem
  const pdfBase64Efetivo = pdf_base64 || null

  // AUTO/LTCAT/PCMSO: Claude com PDF nativo (preferencial) → Gemini fallback
  // ASO: Gemini primário → Claude fallback
  if ((tipo === 'auto' || tipo === 'ltcat' || tipo === 'pcmso') && anthropicKey) {
    const claudeResult = await lerComClaude(pdfBase64Efetivo, texto_pdf, paginas, tipo, anthropicKey)
    if (claudeResult) return res.status(200).json({ sucesso: true, ...claudeResult })
    console.log(`Claude falhou para ${tipo.toUpperCase()}, tentando Gemini como fallback`)
  }

  const prompt_aso = `Você é um extrator de dados de ASO brasileiro. Analise o documento e retorne SOMENTE o JSON abaixo preenchido. Não escreva nada antes ou depois do JSON. Campos não encontrados devem ser null.

REGRAS IMPORTANTES:
- Em "exames": liste CADA exame separadamente com seu resultado individual
- Em "riscos": liste CADA agente de risco INDIVIDUALMENTE — não agrupe vários numa só string. Exemplos corretos: ["Ruído contínuo ou intermitente","Poeira respirável sílica","Queda de nível diferente","Vapores alcalinos"]. Exemplos ERRADOS: ["Ruído, poeira, queda"] ou ["FÍSICO"] ou ["QUÍMICO"] ou ["ERGONÔMICO"]
- Ignore rótulos de categoria como "Físico", "Químico", "Ergonômico", "Biológico" — extraia somente os nomes dos agentes específicos
- Se o documento listar riscos separados por vírgula ou em tabela, extraia cada um como item separado da lista

{
  "funcionario":{"nome":null,"cpf":null,"data_nasc":null,"data_adm":null,"matricula":null,"funcao":null,"setor":null},
  "aso":{"tipo_aso":"periodico","data_exame":null,"prox_exame":null,"conclusao":"apto","medico_nome":null,"medico_crm":null},
  "exames":[{"nome":"nome do exame","resultado":"Normal ou Alterado ou Pendente"}],
  "riscos":["risco individual 1","risco individual 2","risco individual 3"],
  "confianca":{"nome":85,"cpf":85,"tipo_aso":80,"data_exame":90,"conclusao":85}
}`

  const prompt_ltcat = `Você é um extrator especializado em LTCAT (Laudo Técnico das Condições Ambientais do Trabalho) brasileiro.
Analise o documento completo e retorne SOMENTE o JSON abaixo. Nenhum texto antes ou depois. Campos não encontrados: null.

REGRAS CRÍTICAS:
1. "funcoes" de cada GHE: extraia CADA cargo/função do campo "FUNÇÕES DO GRUPO", "CARGOS DO GRUPO", "CARGOS", "FUNÇÕES" ou tabela similar. São listas separadas por vírgula, ponto-e-vírgula ou quebra de linha. Extraia CADA UM como item separado do array — podem ser dezenas de itens. NUNCA agrupe ou resuma. Se a lista tiver 40 cargos, o array deve ter 40 itens. Exemplo: "Apontador, Analista de controle, Eng. mecânico" → ["Apontador","Analista de controle","Eng. mecânico"].
2. "nome" do GHE: use o identificador como "GHE 01", "GHE 02", "GRUPO 01", "GRUPO: 02" etc.
   TABELAS: se o documento tiver tabelas HTML ou estrutura de grid, extraia o conteúdo de todas as células relevantes.
3. "setor": campo "SETOR" ou "ÁREA" do GHE quando disponível.
4. "agentes": CADA agente de risco separado. tipo: fis=físico, qui=químico, bio=biológico, erg=ergonômico.
   Se o GHE indicar ausência de risco com qualquer expressão ("Inexiste", "Ausência", "Não há agentes", "Sem exposição", "Não significativo", "Abaixo do LT", "ISENTO", "NÃO HÁ RISCO") → agentes = [] e aposentadoria_especial = false.
5. "aposentadoria_especial": true SOMENTE se o laudo confirmar direito a aposentadoria especial. false quando não há agentes nocivos.
6. "epi" e "epc": liste cada equipamento individualmente com CA quando disponível.

{
  "dados_gerais":{"data_emissao":null,"data_vigencia":null,"prox_revisao":null,"resp_nome":null,"resp_conselho":"CREA","resp_registro":null},
  "ghes":[{
    "nome":"GHE 01",
    "setor":null,
    "qtd_trabalhadores":1,
    "aposentadoria_especial":false,
    "funcoes":["Cargo 1","Cargo 2","Função 3"],
    "agentes":[{"tipo":"fis","nome":"Ruído contínuo","valor":null,"limite":null,"supera_lt":false}],
    "epc":[{"nome":"nome do EPC","eficaz":true}],
    "epi":[{"nome":"nome do EPI","ca":"12345","eficaz":true}]
  }],
  "confianca":{"data_emissao":90,"resp_nome":90,"ghes":85}
}`

  const promptBase = tipo === 'ltcat' ? prompt_ltcat : tipo === 'auto' ? PROMPT_AUTO : tipo === 'pcmso' ? PROMPT_PCMSO : prompt_aso
  const usandoTexto = texto_pdf && texto_pdf.replace(/\s/g,'').length > 100

  function extrairJSON(str) {
    const ini = str.indexOf('{'); if (ini===-1) return null
    let d=0
    for (let i=ini;i<str.length;i++) { if(str[i]==='{')d++; if(str[i]==='}'){d--;if(d===0)return str.substring(ini,i+1)} }
    return null
  }

  function parseRobusto(texto) {
    const limpo = texto.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
    for (const fn of [
      ()=>JSON.parse(limpo),
      ()=>JSON.parse(extrairJSON(limpo)),
      ()=>JSON.parse(extrairJSON(texto)),
    ]) { try { const r=fn(); if(r) return r } catch {} }
    return null
  }

  // Enriquece resultado com códigos das tabelas
  function enriquecer(dados, tipo) {
    if (!dados) return dados
    if (tipo !== 'ltcat') {
      // Mapeia exames → Tabela 27
      if (dados.exames?.length) {
        dados.exames = dados.exames.map(ex => ({
          ...ex,
          codigo_t27: codigoExame(ex.nome),
        }))
      }
      // Mapeia riscos → Tabela 24
      if (dados.riscos?.length) {
        dados.riscos_codificados = dados.riscos.map(r => ({
          nome: r,
          codigo_t24: codigoAgente(r),
          tipo: codigoAgente(r).startsWith('01') ? 'fis'
              : codigoAgente(r).startsWith('02') ? 'qui'
              : codigoAgente(r).startsWith('03') ? 'bio'
              : codigoAgente(r).startsWith('09') ? 'aus' : 'out',
        }))
      }
    } else {
      // LTCAT: mapeia agentes dos GHEs → Tabela 24
      if (dados.ghes?.length) {
        dados.ghes = dados.ghes.map(ghe => ({
          ...ghe,
          agentes: (ghe.agentes||[]).map(ag => ({
            ...ag,
            codigo_t24: codigoAgente(ag.nome),
          }))
        }))
      }
    }
    return dados
  }

  // ── GEMINI ─────────────────────────────────────────
  if (geminiKey) {
    const modelos = usandoTexto
      ? ['gemini-2.5-flash-lite','gemini-2.5-flash']
      : ['gemini-2.5-flash','gemini-2.5-flash-lite']

    let parts = []
    if (pdfBase64Efetivo && (tipo === 'auto' || tipo === 'pcmso' || tipo === 'ltcat')) {
      // Gemini também suporta PDF inline (base64 direto ou baixado do storage)
      parts = [
        { inlineData: { mimeType: 'application/pdf', data: pdfBase64Efetivo } },
        { text: promptBase }
      ]
    } else if (usandoTexto) {
      // Pré-processar: extrair seções de FUNÇÕES DO GRUPO do texto bruto
      let textoProcessado = texto_pdf
      if (tipo === 'ltcat' || tipo === 'auto') {
        textoProcessado = texto_pdf
          .replace(/FUNÇÕES DO GRUPO:/gi, '\n\n===FUNÇÕES DO GRUPO===\n')
          .replace(/CARGOS DO GRUPO:/gi, '\n\n===FUNÇÕES DO GRUPO===\n')
          .replace(/FUNÇÃO DO GRUPO:/gi, '\n\n===FUNÇÕES DO GRUPO===\n')
          .replace(/NOMENCLATURA GHE\/GF/gi, '\n\n===GHE===\n')
          .replace(/DESCRIÇÃO DAS ATIVIDADES/gi, '\n\n===ATIVIDADES===\n')
      }
      parts = [{ text: `${promptBase}\n\nTEXTO DO DOCUMENTO:\n${textoProcessado.substring(0,20000)}` }]
    } else if (paginas?.length > 0) {
      parts = [
        ...paginas.map(b64 => ({ inlineData: { mimeType:'image/jpeg', data:b64 } })),
        { text: promptBase }
      ]
    }

    for (const modelo of modelos) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
          {
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'x-goog-api-key': geminiKey },
            body: JSON.stringify({ contents:[{parts}], generationConfig:{temperature:0,maxOutputTokens:8192} })
          }
        )
        if (!response.ok) {
          const err = await response.json()
          if ([429,503].includes(err?.error?.code)) { console.log(`${modelo}: quota/503, tentando próximo`); continue }
          throw new Error(JSON.stringify(err))
        }
        const data = await response.json()
        const texto = (data.candidates?.[0]?.content?.parts||[]).filter(p=>p.text).map(p=>p.text).join('')
        const resultado = parseRobusto(texto)
        if (resultado) {
          if (tipo === 'auto' && resultado.tipo) {
            const tipoDetectado = resultado.tipo
            const { tipo: _, ...dadosSemTipo } = resultado
            return res.status(200).json({ sucesso:true, tipo_detectado: tipoDetectado, dados: enriquecer(dadosSemTipo, tipoDetectado), modo: usandoTexto?'texto':'imagem', modelo })
          }
          return res.status(200).json({ sucesso:true, dados: enriquecer(resultado, tipo), modo: usandoTexto?'texto':'imagem', modelo })
        }
      } catch (err) { console.log(`Erro ${modelo}:`, err.message); continue }
    }
  }

  // ── ANTHROPIC FALLBACK ─────────────────────────────
  if (anthropicKey) {
    try {
      let content = []
      if (paginas?.length > 0) paginas.forEach(b64 => {
        content.push({ type:'image', source:{ type:'base64', media_type:'image/jpeg', data:b64 } })
      })
      content.push({ type:'text', text: usandoTexto
        ? `${promptBase}\n\nTEXTO DO DOCUMENTO:\n${texto_pdf?.substring(0,12000)}`
        : promptBase
      })
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-api-key': anthropicKey, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:4000, messages:[{role:'user',content}] })
      })
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json()
      const resultado = parseRobusto(data.content?.[0]?.text || '')
      if (resultado) {
        return res.status(200).json({ sucesso:true, dados: enriquecer(resultado, tipo), modo: usandoTexto?'texto':'imagem', modelo:'claude-fallback' })
      }
    } catch (err) {
      return res.status(500).json({ erro:'Erro no Anthropic: ' + err.message })
    }
  }

  const msgFinal = tipo === 'auto'
    ? 'Não foi possível identificar o documento. Certifique-se que é um PDF de ASO, LTCAT ou PCMSO e que a ANTHROPIC_API_KEY está configurada.'
    : 'Todas as APIs falharam. Tente novamente em alguns minutos.'
  return res.status(500).json({ erro: msgFinal })
}
