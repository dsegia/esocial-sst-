export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const { paginas, texto_pdf, tipo } = req.body

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ erro: 'GEMINI_API_KEY não configurada na Vercel' })

  const prompt_aso = `Analise este ASO (Atestado de Saúde Ocupacional) brasileiro e extraia os dados.
Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois.
{
  "funcionario": {
    "nome": "nome completo ou null",
    "cpf": "000.000.000-00 ou null",
    "data_nasc": "DD/MM/AAAA ou null",
    "data_adm": "DD/MM/AAAA ou null",
    "matricula": "matrícula ou null",
    "funcao": "função ou null",
    "setor": "setor ou null"
  },
  "aso": {
    "tipo_aso": "admissional ou periodico ou retorno ou mudanca ou demissional ou monitoracao",
    "data_exame": "DD/MM/AAAA ou null",
    "prox_exame": "DD/MM/AAAA ou null",
    "conclusao": "apto ou inapto ou apto_restricao",
    "medico_nome": "nome ou null",
    "medico_crm": "CRM ou null"
  },
  "exames": [{"nome": "exame", "resultado": "Normal ou Alterado ou Pendente"}],
  "riscos": [],
  "confianca": {"nome": 85, "cpf": 85, "tipo_aso": 80, "data_exame": 90, "conclusao": 85}
}`

  const prompt_ltcat = `Analise este LTCAT brasileiro e extraia os dados.
Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois.
{
  "dados_gerais": {
    "data_emissao": "DD/MM/AAAA ou null",
    "data_vigencia": "DD/MM/AAAA ou null",
    "prox_revisao": "DD/MM/AAAA ou null",
    "resp_nome": "nome ou null",
    "resp_conselho": "CREA ou CRQ ou CRM",
    "resp_registro": "número ou null"
  },
  "ghes": [{
    "nome": "GHE", "setor": "setor", "qtd_trabalhadores": 1,
    "aposentadoria_especial": false,
    "agentes": [{"tipo": "fis", "nome": "agente", "valor": "v", "limite": "l", "supera_lt": false}],
    "epc": [], "epi": []
  }],
  "confianca": {"data_emissao": 90, "resp_nome": 90, "ghes": 75}
}`

  const promptBase = tipo === 'ltcat' ? prompt_ltcat : prompt_aso

  try {
    let parts = []

    // MODO 1: texto extraído do PDF (PDF digital — melhor qualidade)
    if (texto_pdf && texto_pdf.length > 50) {
      parts = [{ text: `${promptBase}\n\nTEXTO DO DOCUMENTO:\n${texto_pdf.substring(0, 8000)}` }]
    }
    // MODO 2: imagens (PDF scan)
    else if (paginas && paginas.length > 0) {
      parts = [
        ...paginas.map(b64 => ({ inlineData: { mimeType: 'image/jpeg', data: b64 } })),
        { text: promptBase }
      ]
    } else {
      return res.status(400).json({ erro: 'Nenhum conteúdo enviado' })
    }

    // Gemini 2.0 Flash para texto, 2.5 Flash para imagens
    const modelo = (texto_pdf && texto_pdf.length > 50)
      ? 'gemini-2.0-flash'
      : 'gemini-2.5-flash'

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0, maxOutputTokens: 2000 }
        })
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      return res.status(500).json({ erro: 'Erro Gemini: ' + errText })
    }

    const data = await response.json()
    const texto = (data.candidates?.[0]?.content?.parts || [])
      .filter(p => p.text)
      .map(p => p.text)
      .join('')

    // Parser robusto
    let resultado
    const tentativas = [
      () => JSON.parse(texto.trim()),
      () => JSON.parse(texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()),
      () => { const m = texto.match(/\{[\s\S]*\}/); if(m) return JSON.parse(m[0]); throw new Error('no match') }
    ]

    for (const fn of tentativas) {
      try { resultado = fn(); break } catch {}
    }

    if (!resultado) {
      return res.status(500).json({
        erro: 'Não foi possível extrair dados. PDF pode estar ilegível.',
        debug: texto.substring(0, 400)
      })
    }

    return res.status(200).json({ sucesso: true, dados: resultado, modo: texto_pdf ? 'texto' : 'imagem' })

  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno: ' + err.message })
  }
}
