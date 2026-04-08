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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const { paginas, texto_pdf, tipo } = req.body
  const geminiKey    = process.env.GEMINI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!geminiKey && !anthropicKey) return res.status(500).json({ erro: 'Nenhuma API key configurada' })

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

  const prompt_ltcat = `Você é um extrator de dados de LTCAT brasileiro. Retorne SOMENTE o JSON abaixo. Campos não encontrados devem ser null.
{
  "dados_gerais":{"data_emissao":null,"data_vigencia":null,"prox_revisao":null,"resp_nome":null,"resp_conselho":"CREA","resp_registro":null},
  "ghes":[{"nome":"GHE 01","setor":null,"qtd_trabalhadores":1,"aposentadoria_especial":false,
    "agentes":[{"tipo":"fis","nome":"nome do agente","valor":null,"limite":null,"supera_lt":false}],
    "epc":[{"nome":"EPC","eficaz":true}],
    "epi":[{"nome":"EPI","ca":null,"eficaz":true}]
  }],
  "confianca":{"data_emissao":90,"resp_nome":90,"ghes":75}
}`

  const promptBase = tipo === 'ltcat' ? prompt_ltcat : prompt_aso
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
    if (usandoTexto) {
      parts = [{ text: `${promptBase}\n\nTEXTO DO DOCUMENTO:\n${texto_pdf.substring(0,12000)}` }]
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

  return res.status(500).json({ erro:'Todas as APIs falharam. Tente novamente em alguns minutos.' })
}
