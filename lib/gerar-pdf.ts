// lib/gerar-pdf.ts
// Geração de PDF para ASO, LTCAT e PCMSO usando jsPDF

export async function gerarPdfAso(dados: any): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W = 210
  const mg = 15
  const col = (W - mg * 2) / 2

  let y = 15

  function linha(yPos: number) {
    doc.setDrawColor(220, 220, 220)
    doc.line(mg, yPos, W - mg, yPos)
  }

  function titulo(texto: string, yPos: number): number {
    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'normal')
    doc.text(texto.toUpperCase(), mg, yPos)
    return yPos + 4
  }

  function valor(texto: string, yPos: number, xPos = mg): number {
    doc.setFontSize(10)
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'normal')
    doc.text(texto || '—', xPos, yPos)
    return yPos + 5
  }

  function secao(texto: string, yPos: number): number {
    doc.setFillColor(24, 95, 165)
    doc.rect(mg, yPos, W - mg * 2, 6, 'F')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text(texto, mg + 3, yPos + 4.2)
    doc.setTextColor(30, 30, 30)
    return yPos + 10
  }

  // ── Cabeçalho ──────────────────────────────────────────────
  doc.setFillColor(24, 95, 165)
  doc.rect(0, 0, W, 20, 'F')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('ATESTADO DE SAÚDE OCUPACIONAL — ASO', W / 2, 9, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('NR-7 / Portaria MTE 3.214/78', W / 2, 15, { align: 'center' })

  y = 26

  // ── Dados do Funcionário ───────────────────────────────────
  y = secao('DADOS DO FUNCIONÁRIO / TRABALHADOR', y)
  const func = dados?.funcionario || {}

  y = titulo('NOME COMPLETO', y)
  y = valor(func.nome, y)

  const y1 = y
  y = titulo('CPF', y)
  y = valor(func.cpf, y)

  doc.setFontSize(7); doc.setTextColor(100); doc.text('DATA DE NASCIMENTO', mg + col + 5, y1)
  doc.setFontSize(10); doc.setTextColor(30)
  doc.text(func.data_nasc ? new Date(func.data_nasc + 'T00:00').toLocaleDateString('pt-BR') : '—', mg + col + 5, y1 + 4)

  linha(y + 1); y += 4

  const y2 = y
  y = titulo('FUNÇÃO / CARGO', y)
  y = valor(func.funcao, y)
  doc.setFontSize(7); doc.setTextColor(100); doc.text('SETOR', mg + col + 5, y2)
  doc.setFontSize(10); doc.setTextColor(30)
  doc.text(func.setor || '—', mg + col + 5, y2 + 4)

  linha(y + 1); y += 4

  const y3 = y
  y = titulo('DATA DE ADMISSÃO', y)
  y = valor(func.data_adm ? new Date(func.data_adm + 'T00:00').toLocaleDateString('pt-BR') : '—', y)
  doc.setFontSize(7); doc.setTextColor(100); doc.text('MATRÍCULA', mg + col + 5, y3)
  doc.setFontSize(10); doc.setTextColor(30)
  doc.text(func.matricula || '—', mg + col + 5, y3 + 4)

  linha(y + 1); y += 6

  // ── ASO ────────────────────────────────────────────────────
  y = secao('DADOS DO EXAME OCUPACIONAL', y)
  const aso = dados?.aso || {}

  const TIPO_ASO: Record<string, string> = {
    admissional: 'Admissional', periodico: 'Periódico', retorno: 'Retorno ao Trabalho',
    mudanca: 'Mudança de Função', demissional: 'Demissional', monitoracao: 'Monitoração Pontual',
  }

  const y4 = y
  y = titulo('TIPO DE EXAME', y)
  y = valor(TIPO_ASO[aso.tipo_aso] || aso.tipo_aso || '—', y)
  doc.setFontSize(7); doc.setTextColor(100); doc.text('DATA DO EXAME', mg + col + 5, y4)
  doc.setFontSize(10); doc.setTextColor(30)
  doc.text(aso.data_exame ? new Date(aso.data_exame + 'T00:00').toLocaleDateString('pt-BR') : '—', mg + col + 5, y4 + 4)

  linha(y + 1); y += 4

  const y5 = y
  y = titulo('PRÓXIMO EXAME', y)
  y = valor(aso.prox_exame ? new Date(aso.prox_exame + 'T00:00').toLocaleDateString('pt-BR') : '—', y)

  const CONCLUSAO: Record<string, string> = { apto: 'APTO', inapto: 'INAPTO', apto_restricao: 'APTO COM RESTRIÇÃO' }
  const conclusao = CONCLUSAO[aso.conclusao] || aso.conclusao || 'APTO'
  const corConclusao = aso.conclusao === 'inapto' ? [220, 38, 38] : aso.conclusao === 'apto_restricao' ? [180, 100, 0] : [39, 80, 10]

  doc.setFontSize(7); doc.setTextColor(100); doc.text('CONCLUSÃO', mg + col + 5, y5)
  doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.setTextColor(corConclusao[0], corConclusao[1], corConclusao[2])
  doc.text(conclusao, mg + col + 5, y5 + 5)
  doc.setFont('helvetica', 'normal')

  linha(y + 1); y += 6

  // ── Exames realizados ──────────────────────────────────────
  if (dados?.exames?.length) {
    y = secao('EXAMES REALIZADOS', y)
    for (let i = 0; i < dados.exames.length && y < 240; i++) {
      const ex = dados.exames[i]
      const nome = typeof ex === 'string' ? ex : ex.nome
      const resultado = typeof ex === 'object' ? ex.resultado : ''
      doc.setFontSize(9); doc.setTextColor(30); doc.setFont('helvetica', 'normal')
      doc.text(`• ${nome}`, mg + 2, y)
      if (resultado) {
        const corR = resultado.toLowerCase().includes('alter') ? [220, 38, 38] : [39, 80, 10]
        doc.setTextColor(corR[0], corR[1], corR[2])
        doc.text(resultado, W - mg - 2, y, { align: 'right' })
      }
      doc.setTextColor(30)
      y += 5
    }
    y += 2
  }

  // ── Riscos ─────────────────────────────────────────────────
  if (dados?.riscos?.length) {
    if (y > 230) { doc.addPage(); y = 20 }
    y = secao('FATORES DE RISCO OCUPACIONAL', y)
    const cols = 2
    const rw = (W - mg * 2 - 5) / cols
    for (let i = 0; i < dados.riscos.length && y < 265; i++) {
      const r = typeof dados.riscos[i] === 'string' ? dados.riscos[i] : dados.riscos[i]?.nome || ''
      const x = mg + 2 + (i % cols) * (rw + 5)
      if (i % cols === 0 && i > 0) y += 5
      doc.setFontSize(9); doc.setTextColor(30)
      doc.text(`• ${r}`, x, y)
    }
    if (dados.riscos.length % cols !== 0) y += 5
    y += 4
  }

  // ── Médico ─────────────────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 20 }
  y = secao('RESPONSÁVEL TÉCNICO', y)
  const y6 = y
  y = titulo('MÉDICO EXAMINADOR', y)
  y = valor(aso.medico_nome || '—', y)
  doc.setFontSize(7); doc.setTextColor(100); doc.text('CRM', mg + col + 5, y6)
  doc.setFontSize(10); doc.setTextColor(30)
  doc.text(aso.medico_crm ? `CRM ${aso.medico_crm}` : '—', mg + col + 5, y6 + 4)

  y += 6
  linha(y); y += 8

  // Assinatura
  const xMed = W / 2
  doc.line(xMed - 35, y, xMed + 35, y)
  y += 4
  doc.setFontSize(8); doc.setTextColor(80)
  doc.text('Assinatura e carimbo do médico examinador', xMed, y, { align: 'center' })
  y += 8
  linha(y); y += 8
  doc.line(mg + 10, y, mg + 80, y)
  doc.line(W - mg - 80, y, W - mg - 10, y)
  y += 4
  doc.setFontSize(8)
  doc.text('Assinatura do empregado', mg + 45, y, { align: 'center' })
  doc.text('Assinatura do empregador', W - mg - 45, y, { align: 'center' })

  // Rodapé
  const totalPags = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p)
    doc.setFontSize(7); doc.setTextColor(150)
    doc.text(`eSocial SST — Gerado em ${new Date().toLocaleDateString('pt-BR')}`, mg, 292)
    doc.text(`Página ${p}/${totalPags}`, W - mg, 292, { align: 'right' })
  }

  const nome = dados?.funcionario?.nome?.replace(/\s+/g, '_') || 'funcionario'
  const data = dados?.aso?.data_exame || new Date().toISOString().split('T')[0]
  doc.save(`ASO_${nome}_${data}.pdf`)
}

export async function gerarPdfLtcat(dados: any, empresa: any): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210; const mg = 15
  let y = 15

  function linha(yPos: number) {
    doc.setDrawColor(220, 220, 220)
    doc.line(mg, yPos, W - mg, yPos)
  }
  function secao(texto: string, yPos: number): number {
    doc.setFillColor(24, 95, 165)
    doc.rect(mg, yPos, W - mg * 2, 6, 'F')
    doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold')
    doc.text(texto, mg + 3, yPos + 4.2)
    doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'normal')
    return yPos + 10
  }
  function campo(label: string, valor: string, xPos: number, yPos: number, largura: number): number {
    doc.setFontSize(7); doc.setTextColor(100); doc.text(label.toUpperCase(), xPos, yPos)
    doc.setFontSize(10); doc.setTextColor(30)
    const linhas = doc.splitTextToSize(valor || '—', largura - 2)
    doc.text(linhas, xPos, yPos + 4)
    return yPos + 4 + linhas.length * 5
  }

  // Cabeçalho
  doc.setFillColor(24, 95, 165)
  doc.rect(0, 0, W, 20, 'F')
  doc.setFontSize(13); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold')
  doc.text('LAUDO TÉCNICO DAS CONDIÇÕES AMBIENTAIS DO TRABALHO', W / 2, 8, { align: 'center' })
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text('LTCAT — NR-15 / Decreto 3.048/99 Art. 68', W / 2, 14, { align: 'center' })
  y = 26

  // Empresa
  y = secao('DADOS DA EMPRESA', y)
  const yw = (W - mg * 2)
  campo('Razão Social', empresa?.razao_social, mg, y, yw / 2)
  campo('CNPJ', empresa?.cnpj, mg + yw / 2 + 5, y, yw / 2 - 5)
  y += 10
  campo('Endereço', empresa?.endereco, mg, y, yw / 2)
  campo('Município/UF', `${empresa?.municipio || '—'}/${empresa?.uf || '—'}`, mg + yw / 2 + 5, y, yw / 2 - 5)
  y += 10; linha(y); y += 6

  // Dados gerais do laudo
  y = secao('DADOS DO LAUDO', y)
  const dg = dados?.dados_gerais || {}
  const col = (W - mg * 2 - 10) / 3
  campo('Data de Emissão', dg.data_emissao ? new Date(dg.data_emissao + 'T00:00').toLocaleDateString('pt-BR') : '—', mg, y, col)
  campo('Data de Vigência', dg.data_vigencia ? new Date(dg.data_vigencia + 'T00:00').toLocaleDateString('pt-BR') : '—', mg + col + 5, y, col)
  campo('Próxima Revisão', dg.prox_revisao ? new Date(dg.prox_revisao + 'T00:00').toLocaleDateString('pt-BR') : '—', mg + (col + 5) * 2, y, col)
  y += 10; linha(y); y += 6
  campo('Responsável Técnico', dg.resp_nome, mg, y, (W - mg * 2) / 2)
  campo(`${dg.resp_conselho || 'CREA'} Nº`, dg.resp_registro, mg + (W - mg * 2) / 2 + 5, y, (W - mg * 2) / 2 - 5)
  y += 12; linha(y); y += 6

  // GHEs
  const ghes = dados?.ghes || []
  for (let gi = 0; gi < ghes.length; gi++) {
    const ghe = ghes[gi]
    if (y > 255) { doc.addPage(); y = 20 }
    y = secao(`GHE ${gi + 1}: ${ghe.nome || '—'}`, y)

    if (ghe.setor) {
      campo('Setor', ghe.setor, mg, y, (W - mg * 2) / 2)
    }
    campo('Qtd. Trabalhadores', String(ghe.qtd_trabalhadores || '—'), mg + (W - mg * 2) / 2 + 5, y, (W - mg * 2) / 2 - 5)
    campo('Aposentadoria Especial', ghe.aposentadoria_especial ? 'SIM' : 'NÃO', mg + (W - mg * 2) * 0.75 + 5, y, (W - mg * 2) / 4 - 5)
    y += 10

    if (ghe.funcoes?.length) {
      doc.setFontSize(7); doc.setTextColor(100); doc.text('FUNÇÕES/CARGOS', mg, y); y += 4
      doc.setFontSize(9); doc.setTextColor(30)
      const funcText = ghe.funcoes.join(' • ')
      const linhas = doc.splitTextToSize(funcText, W - mg * 2 - 2)
      doc.text(linhas, mg, y); y += linhas.length * 4 + 3
    }

    if (ghe.agentes?.length) {
      doc.setFontSize(7); doc.setTextColor(100); doc.text('AGENTES DE RISCO', mg, y); y += 4
      for (const ag of ghe.agentes) {
        if (y > 265) { doc.addPage(); y = 20 }
        const tipoMap: Record<string, string> = { fis: 'Físico', qui: 'Químico', bio: 'Biológico', erg: 'Ergonômico' }
        const tipo = tipoMap[ag.tipo] || ag.tipo || ''
        doc.setFontSize(9); doc.setTextColor(30)
        doc.text(`• [${tipo}] ${ag.nome}${ag.valor ? ` — ${ag.valor}` : ''}`, mg + 2, y)
        y += 4.5
      }
      y += 2
    } else {
      doc.setFontSize(9); doc.setTextColor(39, 80, 10)
      doc.text('Sem agentes de risco significativos', mg + 2, y); y += 6
    }

    linha(y); y += 5
  }

  // Rodapé
  const totalPags = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p)
    doc.setFontSize(7); doc.setTextColor(150)
    doc.text(`eSocial SST — Gerado em ${new Date().toLocaleDateString('pt-BR')}`, mg, 292)
    doc.text(`Página ${p}/${totalPags}`, W - mg, 292, { align: 'right' })
  }

  const data = dados?.dados_gerais?.data_emissao || new Date().toISOString().split('T')[0]
  doc.save(`LTCAT_${empresa?.cnpj?.replace(/\D/g, '') || 'empresa'}_${data}.pdf`)
}

export async function gerarPdfPcmso(dados: any, empresa: any): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210; const mg = 15
  let y = 15

  function secao(texto: string, yPos: number): number {
    doc.setFillColor(39, 80, 10)
    doc.rect(mg, yPos, W - mg * 2, 6, 'F')
    doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold')
    doc.text(texto, mg + 3, yPos + 4.2)
    doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'normal')
    return yPos + 10
  }

  // Cabeçalho
  doc.setFillColor(39, 80, 10)
  doc.rect(0, 0, W, 20, 'F')
  doc.setFontSize(13); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold')
  doc.text('PROGRAMA DE CONTROLE MÉDICO DE SAÚDE OCUPACIONAL', W / 2, 8, { align: 'center' })
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text('PCMSO — NR-7 / Portaria MTE 3.214/78', W / 2, 14, { align: 'center' })
  y = 26

  // Empresa
  y = secao('DADOS DA EMPRESA', y)
  doc.setFontSize(7); doc.setTextColor(100); doc.text('RAZÃO SOCIAL', mg, y); y += 4
  doc.setFontSize(11); doc.setTextColor(30); doc.setFont('helvetica', 'bold')
  doc.text(empresa?.razao_social || '—', mg, y); doc.setFont('helvetica', 'normal'); y += 5
  doc.setFontSize(9); doc.setTextColor(80)
  doc.text(`CNPJ: ${empresa?.cnpj || '—'} | ${empresa?.municipio || '—'}/${empresa?.uf || '—'}`, mg, y); y += 8

  const dg = dados?.dados_gerais || {}
  doc.setFontSize(7); doc.setTextColor(100)
  doc.text('MÉDICO COORDENADOR', mg, y); doc.text('CRM', mg + 90, y); doc.text('ELABORAÇÃO', mg + 140, y); y += 4
  doc.setFontSize(10); doc.setTextColor(30)
  doc.text(dg.medico_nome || '—', mg, y)
  doc.text(dg.medico_crm ? `CRM ${dg.medico_crm}` : '—', mg + 90, y)
  doc.text(dg.data_elaboracao ? new Date(dg.data_elaboracao + 'T00:00').toLocaleDateString('pt-BR') : '—', mg + 140, y)
  y += 10

  // Programas por função
  const programas = dados?.programas || []
  for (let pi = 0; pi < programas.length; pi++) {
    const prog = programas[pi]
    if (y > 245) { doc.addPage(); y = 20 }
    y = secao(`FUNÇÃO: ${prog.funcao || '—'}${prog.setor ? ` — ${prog.setor}` : ''}`, y)

    if (prog.riscos?.length) {
      doc.setFontSize(7); doc.setTextColor(100); doc.text('RISCOS OCUPACIONAIS', mg, y); y += 4
      doc.setFontSize(9); doc.setTextColor(80)
      const riscosText = prog.riscos.join(' • ')
      const linhas = doc.splitTextToSize(riscosText, W - mg * 2)
      doc.text(linhas, mg, y); y += linhas.length * 4 + 3
    }

    if (prog.exames?.length) {
      doc.setFontSize(7); doc.setTextColor(100); doc.text('EXAMES PREVISTOS', mg, y); y += 4
      doc.setFillColor(245, 247, 250)
      doc.rect(mg, y, W - mg * 2, 5.5, 'F')
      doc.setFontSize(8); doc.setTextColor(80); doc.setFont('helvetica', 'bold')
      doc.text('EXAME', mg + 2, y + 4); doc.text('PERIODICIDADE', mg + 110, y + 4)
      doc.setFont('helvetica', 'normal'); y += 7

      for (const ex of prog.exames) {
        if (y > 270) { doc.addPage(); y = 20 }
        const nome = typeof ex === 'string' ? ex : ex.nome
        const period = typeof ex === 'object' ? ex.periodicidade || 'Anual' : 'Anual'
        doc.setFontSize(9); doc.setTextColor(30)
        doc.text(`• ${nome}`, mg + 2, y)
        doc.setTextColor(80); doc.text(period, mg + 110, y)
        doc.setDrawColor(240); doc.line(mg, y + 1.5, W - mg, y + 1.5)
        y += 5.5
      }
    }
    y += 4
  }

  const totalPags = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p)
    doc.setFontSize(7); doc.setTextColor(150)
    doc.text(`eSocial SST — Gerado em ${new Date().toLocaleDateString('pt-BR')}`, mg, 292)
    doc.text(`Página ${p}/${totalPags}`, W - mg, 292, { align: 'right' })
  }

  const data = dg.data_elaboracao || new Date().toISOString().split('T')[0]
  doc.save(`PCMSO_${empresa?.cnpj?.replace(/\D/g, '') || 'empresa'}_${data}.pdf`)
}
