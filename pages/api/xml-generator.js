// pages/api/xml-generator.js
// Gera XML eSocial S-2220, S-2240 e S-2210 com códigos da Tabela 27

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const { tipo, dados, empresa, ambiente = 'producao_restrita' } = req.body
  if (!tipo || !dados || !empresa) return res.status(400).json({ erro: 'Dados incompletos' })

  // tpAmb: 1=Produção, 2=Produção Restrita (testes)
  const tpAmb = ambiente === 'producao' ? '1' : '2'

  try {
    let xml = ''
    if (tipo === 'S-2220') xml = gerarS2220(dados, empresa, tpAmb)
    else if (tipo === 'S-2240') xml = gerarS2240(dados, empresa, tpAmb)
    else if (tipo === 'S-2210') xml = gerarS2210(dados, empresa, tpAmb)
    else return res.status(400).json({ erro: 'Tipo inválido' })

    return res.status(200).json({ sucesso: true, xml })
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao gerar XML: ' + err.message })
  }
}

// ─── HELPERS ─────────────────────────────────────────
function cnpj(v) { return (v || '').replace(/\D/g, '') }
function cpf(v)  { return (v || '').replace(/\D/g, '') }
function data(br) {
  if (!br) return ''
  if (br.includes('-')) return br.substring(0, 10)
  const [d, m, y] = br.split('/')
  return `${y}-${(m||'').padStart(2,'0')}-${(d||'').padStart(2,'0')}`
}
function id(cnpjEmp) {
  const ts = Date.now().toString()
  return `ID${cnpjEmp}${ts}`
}

// Mapa de tipo ASO → código eSocial
const TIPO_ASO = {
  admissional: '0', periodico: '1', retorno: '2',
  mudanca: '3', monitoracao: '4', demissional: '9'
}

// Mapa de conclusão → código eSocial
const CONCLUSAO = { apto: '1', apto_restricao: '2', inapto: '3' }

// Mapa de exame → código Tabela 27 (principais)
const TABELA27 = {
  'avaliacao clinica': '0001', 'exame clinico': '0001',
  'avaliacao psicossocial': '0002', 'psicossocial': '0002',
  'hemograma': '0010', 'hemograma completo': '0010',
  'glicemia': '0011', 'glicemia de jejum': '0011', 'glicemia/ glicose': '0011', 'glicemia/glicose': '0011',
  'urina': '0012', 'eas': '0012',
  'tipagem sanguinea': '0029', 'tipagem': '0029',
  'audiometria': '0040', 'audiometria tonal': '0040',
  'acuidade visual': '0050', 'visao': '0050',
  'espirometria': '0060',
  'rx torax': '0061', 'rx de torax': '0061', 'rx tórax pa oit': '0061', 'rx torax pa oit': '0061',
  'eletroencefalograma': '0070', 'eeg': '0070',
  'teste de romberg': '0073', 'romberg': '0073',
  'eletrocardiograma': '0080', 'ecg': '0080',
  'rx coluna': '0091', 'coluna': '0091',
}

function codigoExame(nomeExame) {
  const lower = (nomeExame || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
  for (const [chave, codigo] of Object.entries(TABELA27)) {
    if (lower.includes(chave)) return codigo
  }
  return '0200' // Outros
}

// ─── S-2220: MONITORAMENTO DA SAÚDE ──────────────────
function gerarS2220(aso, empresa, tpAmb) {
  const cnpjEmp = cnpj(empresa.cnpj)
  const idEvt = id(cnpjEmp)
  const func = aso.funcionario || {}
  const dadosAso = aso.aso || {}
  const exames = aso.exames || []

  const examesXML = exames.map((ex, i) => `
        <exame>
          <dtExm>${data(dadosAso.data_exame)}</dtExm>
          <procRealizado>
            <codProc>${codigoExame(ex.nome)}</codProc>
            <obsProc>${ex.nome}</obsProc>
          </procRealizado>
          ${ex.resultado ? `<indResult>${ex.resultado === 'Normal' ? '1' : ex.resultado === 'Alterado' ? '2' : '3'}</indResult>` : ''}
        </exame>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_03_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <evtMonit Id="${idEvt}">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>${tpAmb}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjEmp}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${cpf(func.cpf)}</cpfTrab>
      <matricula>${func.matricula_esocial || ''}</matricula>
    </ideVinculo>
    <aso>
      <dtAso>${data(dadosAso.data_exame)}</dtAso>
      <tpAso>${TIPO_ASO[dadosAso.tipo_aso] || '1'}</tpAso>
      ${examesXML}
      <medico>
        <nmMed>${dadosAso.medico_nome || ''}</nmMed>
        <nrCRM>${(dadosAso.medico_crm || '').replace(/\D/g, '')}</nrCRM>
        <ufCRM>${(dadosAso.medico_crm || '').split('-').pop()?.trim().replace(/\d/g,'') || 'SP'}</ufCRM>
      </medico>
      <concl>${CONCLUSAO[dadosAso.conclusao] || '1'}</concl>
      ${dadosAso.prox_exame ? `<obsAtiv>Próximo exame previsto: ${data(dadosAso.prox_exame)}</obsAtiv>` : ''}
    </aso>
  </evtMonit>
</eSocial>`
}

// ─── S-2240: CONDIÇÕES AMBIENTAIS ────────────────────
function gerarS2240(ltcat, empresa, tpAmb) {
  const cnpjEmp = cnpj(empresa.cnpj)
  const idEvt = id(cnpjEmp)
  const geral = ltcat.dados_gerais || {}
  const ghes = ltcat.ghes || []

  const TIPO_AGENTE = { fis: '01', qui: '02', bio: '03', erg: '04' }

  const ghesXML = ghes.map(ghe => {
    const agentesXML = (ghe.agentes || []).map(ag => `
        <agNoc>
          <tpAgt>${TIPO_AGENTE[ag.tipo] || '01'}</tpAgt>
          <dsAgt>${ag.nome}</dsAgt>
          ${ag.valor ? `<nrInsc>${ag.valor}</nrInsc>` : ''}
          <ltcat>
            <nrDocTec>${geral.resp_registro || ''}</nrDocTec>
            <ideOC>${geral.resp_conselho || 'CREA'}</ideOC>
            <dscAtvDes>${ag.nome} — ${ag.valor || 'não medido'}</dscAtvDes>
          </ltcat>
          <epcEpi>
            <utilizEpc>${(ghe.epc||[]).length > 0 ? 'S' : 'N'}</utilizEpc>
            <eficEpc>${(ghe.epc||[]).some(e => e.eficaz) ? 'S' : 'N'}</eficEpc>
            <utilizEpi>${(ghe.epi||[]).length > 0 ? 'S' : 'N'}</utilizEpi>
            <eficEpi>${(ghe.epi||[]).some(e => e.eficaz) ? 'S' : 'N'}</eficEpi>
            ${(ghe.epi||[]).map(e => `
            <epi>
              <caEPI>${(e.ca||'').replace(/\D/g,'')}</caEPI>
              <dscEPI>${e.nome}</dscEPI>
            </epi>`).join('')}
          </epcEpi>
        </agNoc>`).join('')

    return `
      <infoAtiv>
        <dscAtivDes>${ghe.nome}</dscAtivDes>
        ${agentesXML}
      </infoAtiv>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_03_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <evtExpRisco Id="${idEvt}">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>${tpAmb}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjEmp}</nrInsc>
    </ideEmpregador>
    <infoExpRisco>
      <iniValid>${data(geral.data_vigencia).substring(0,7)}</iniValid>
      ${ghesXML}
      <respReg>
        <ideResponsavel>
          <nmRespReg>${geral.resp_nome || ''}</nmRespReg>
          <ideOC>${geral.resp_conselho || 'CREA'}</ideOC>
          <nrOC>${geral.resp_registro || ''}</nrOC>
        </ideResponsavel>
      </respReg>
    </infoExpRisco>
  </evtExpRisco>
</eSocial>`
}

// ─── S-2210: CAT ─────────────────────────────────────
function gerarS2210(cat, empresa, tpAmb) {
  const cnpjEmp = cnpj(empresa.cnpj)
  const idEvt = id(cnpjEmp)
  const func = cat.funcionario || {}
  const TIPO_CAT = { tipico: '1', doenca: '2', trajeto: '3' }
  const atend = cat.atendimento || {}
  // diagProvavel deve ser texto descritivo, não o código CID
  const descDiag = cat.descricao || cat.natureza_lesao || cat.cid || ''
  // dtObito deve ser a data real do óbito (se informada) ou a data do acidente
  const dtObito = cat.dt_obito ? data(cat.dt_obito) : data(cat.dt_acidente)

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtCAT/v_S_01_03_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <evtCAT Id="${idEvt}">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>${tpAmb}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjEmp}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${cpf(func.cpf)}</cpfTrab>
      <matricula>${func.matricula_esocial || ''}</matricula>
    </ideVinculo>
    <cat>
      <dtAcid>${data(cat.dt_acidente)}</dtAcid>
      ${cat.hora_acidente ? `<hrAcid>${cat.hora_acidente}</hrAcid>` : ''}
      <tpAcid>${TIPO_CAT[cat.tipo_cat] || '1'}</tpAcid>
      <dscLesao>${cat.natureza_lesao || ''}</dscLesao>
      <dscCompLesao>${cat.descricao || ''}</dscCompLesao>
      <diagProvavel>${descDiag}</diagProvavel>
      <codCID>${cat.cid}</codCID>
      ${cat.houve_morte ? `<infoObito><dtObito>${dtObito}</dtObito></infoObito>` : ''}
      <atendimento>
        <dtAtendimento>${data(atend.data) || data(cat.dt_acidente)}</dtAtendimento>
        ${atend.hora ? `<hrAtendimento>${atend.hora}</hrAtendimento>` : ''}
        <nmMedico>${atend.medico || ''}</nmMedico>
        <nrCRM>${(atend.crm || '').replace(/\D/g,'')}</nrCRM>
        <ufCRM>${(atend.crm || '').split('-').pop()?.trim().replace(/\d/g,'') || 'SP'}</ufCRM>
      </atendimento>
    </cat>
  </evtCAT>
</eSocial>`
}
