export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const { paginas, texto_pdf, tipo } = req.body
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ erro: 'GEMINI_API_KEY não configurada' })

  const prompt_aso = `Você é um extrator de dados de ASO brasileiro. Analise o documento e retorne SOMENTE o JSON abaixo preenchido. Não escreva nada antes ou depois do JSON. Campos não encontrados devem ser null.

{
  "funcionario": {
    "nome": null,
    "cpf": null,
    "data_nasc": null,
    "data_adm": null,
    "matricula": null,
    "funcao": null,
    "setor": null
  },
  "aso": {
    "tipo_aso": "periodico",
    "data_exame": null,
    "prox_exame": null,
    "conclusao": "apto",
    "medico_nome": null,
    "medico_crm": null
  },
  "exames": [
    {"nome": "nome do exame", "resultado": "Normal"}
  ],
  "riscos": ["risco 1", "risco 2"],
  "confianca": {
    "nome": 90,
    "cpf": 90,
    "tipo_aso": 85,
    "data_exame": 90,
    "conclusao": 90,
    "medico_crm": 75
  }
}`

  const prompt_ltcat = `Você é um extrator de dados de LTCAT brasileiro. Retorne SOMENTE o JSON abaixo. Campos não encontrados devem ser null.

{
  "dados_gerais": {
    "data_emissao": null,
    "data_vigencia": null,
    "prox_revisao": null,
    "resp_nome": null,
    "resp_conselho": "CREA",
    "resp_registro": null
  },
  "ghes": [
    {
      "nome": "GHE 01",
      "setor": null,
      "qtd_trabalhadores": 1,
      "aposentadoria_especial": false,
      "agentes": [{"tipo": "fis", "nome": "agente", "valor": null, "limite": null, "supera_lt": false}],
      "epc": [{"nome": "EPC", "eficaz": true}],
      "epi": [{"nome": "EPI", "ca": null, "eficaz": true}]
    }
  ],
  "confianca": {"data_emissao": 90, "resp_nome": 90, "ghes": 75}
}`

  try {
    const usandoTexto = texto_pdf && texto_pdf.replace(/\s/g,'').length > 100
    const promptBase = tipo === 'ltcat' ? prompt_ltcat : prompt_aso

    let parts = []
    if (usandoTexto) {
      parts = [{ text: `${promptBase}\n\nTEXTO DO DOCUMENTO:\n${texto_pdf.substring(0, 12000)}` }]
    } else if (paginas && paginas.length > 0) {
      parts = [
        ...paginas.map(b64 => ({ inlineData: { mimeType: 'image/jpeg', data: b64 } })),
        { text: promptBase }
      ]
    } else {
      return res.status(400).json({ erro: 'Nenhum conteúdo enviado' })
    }

    const modelo = usandoTexto ? 'gemini-2.0-flash' : 'gemini-2.5-flash'

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0, maxOutputTokens: 8192 }
        })
      }
    )

    if (!response.ok) {
      const err = await response.text()
      return res.status(500).json({ erro: 'Erro Gemini: ' + err })
    }

    const data = await response.json()
    const texto = (data.candidates?.[0]?.content?.parts || [])
      .filter(p => p.text).map(p => p.text).join('')

    // Parser com balanceamento de chaves
    const extrairJSON = (str) => {
      const inicio = str.indexOf('{')
      if (inicio === -1) return null
      let depth = 0
      for (let i = inicio; i < str.length; i++) {
        if (str[i] === '{') depth++
        if (str[i] === '}') { depth--; if (depth === 0) return str.substring(inicio, i + 1) }
      }
      return null
    }

    let resultado
    const limpo = texto.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
    for (const fn of [
      () => JSON.parse(limpo),
      () => JSON.parse(extrairJSON(limpo)),
      () => JSON.parse(extrairJSON(texto)),
    ]) {
      try { resultado = fn(); if (resultado) break } catch {}
    }

    if (!resultado) {
      return res.status(500).json({ erro: 'Não foi possível extrair dados.', debug: texto.substring(0, 1000) })
    }

    return res.status(200).json({ sucesso: true, dados: resultado, modo: usandoTexto ? 'texto' : 'imagem' })

  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno: ' + err.message })
  }
}
