import type { ASO, LTCAT, CAT, Funcionario, Empresa } from '../types/database'

// ─── HELPERS ─────────────────────────────────────────────
function xml(tag: string, valor: unknown, attrs?: Record<string, string>): string {
  if (valor === null || valor === undefined || valor === '') return ''
  const attrStr = attrs ? ' ' + Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ') : ''
  return `<${tag}${attrStr}>${String(valor)}</${tag}>`
}

function dataESocial(dataBR: string): string {
  // Converte DD/MM/AAAA → AAAA-MM-DD
  if (!dataBR) return ''
  const p = dataBR.split('/')
  if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`
  return dataBR
}

function cpfSemMascara(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

function cnpjSemMascara(cnpj: string): string {
  return cnpj.replace(/\D/g, '')
}

// ─── CABEÇALHO PADRÃO ────────────────────────────────────
function cabecalho(evento: string, empresa: Empresa): string {
  const agora = new Date()
  const dtHr = agora.toISOString().replace('Z', '')
  return `
  <evtMonit Id="${evento.replace('-', '')}_${Date.now()}">
    <ideEvento>
      <indRetif>1</indRetif>
      <perApur>${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}</perApur>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjSemMascara(empresa.cnpj)}</nrInsc>
    </ideEmpregador>`
}

// ─── S-2220: MONITORAMENTO DA SAÚDE DO TRABALHADOR ───────
export function gerarXML_S2220(
  aso: ASO,
  func: Funcionario,
  empresa: Empresa
): string {
  const tipoMap: Record<string, string> = {
    admissional: '0', periodico: '1', retorno: '2',
    mudanca: '3', demissional: '4', monitoracao: '5'
  }
  const conclusaoMap: Record<string, string> = {
    apto: '1', inapto: '3', apto_restricao: '2'
  }

  const examesXML = (aso.exames as Array<{ nome: string; resultado: string }>).map((e, i) => `
      <exame>
        <dtExm>${dataESocial(aso.data_exame)}</dtExm>
        <tpExm>${i === 0 ? tipoMap[aso.tipo_aso] || '1' : '999'}</tpExm>
        <ordExame>${i + 1}</ordExame>
        <dsExame>${e.nome}</dsExame>
        <resExame>${e.resultado === 'Normal' ? 'N' : 'A'}</resExame>
      </exame>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_03_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_03_00">
  <evtMonit Id="ID${cnpjSemMascara(empresa.cnpj)}${Date.now()}">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjSemMascara(empresa.cnpj)}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${cpfSemMascara(func.cpf)}</cpfTrab>
      <matricula>${func.matricula_esocial}</matricula>
    </ideVinculo>
    <aso>
      <dtAso>${dataESocial(aso.data_exame)}</dtAso>
      <tpAso>${tipoMap[aso.tipo_aso] || '1'}</tpAso>
      ${examesXML}
      <medico>
        <nmMed>${aso.medico_nome || ''}</nmMed>
        <nrCRM>${(aso.medico_crm || '').replace(/\D/g, '')}</nrCRM>
        <ufCRM>${(aso.medico_crm || '').split('-').pop()?.trim() || 'SP'}</ufCRM>
      </medico>
      <concl>${conclusaoMap[aso.conclusao] || '1'}</concl>
      ${aso.prox_exame ? `<dscAtiv>Próximo exame: ${dataESocial(aso.prox_exame)}</dscAtiv>` : ''}
    </aso>
  </evtMonit>
</eSocial>`
}

// ─── S-2240: CONDIÇÕES AMBIENTAIS DE TRABALHO ────────────
export function gerarXML_S2240(
  ltcat: LTCAT,
  func: Funcionario,
  empresa: Empresa
): string {
  const ghes = ltcat.ghes as LTCAT['ghes']

  const gheXML = ghes.map(ghe => {
    const agentesXML = ghe.agentes.map(ag => {
      const tpAgenteMap: Record<string, string> = { fis: '01', qui: '02', bio: '03', erg: '04' }
      return `
        <agNoc>
          <tpAgt>${tpAgenteMap[ag.tipo] || '01'}</tpAgt>
          <dsAgt>${ag.nome}</dsAgt>
          <nrInsc>${ag.valor}</nrInsc>
          <ltcat>
            <nrDocTec>${ltcat.resp_registro || ''}</nrDocTec>
            <ideOC>${ltcat.resp_conselho || 'CREA'}</ideOC>
            <dscAtvDes>${ag.nome} — ${ag.valor}</dscAtvDes>
          </ltcat>
          <epcEpi>
            <utilizEpc>${ghe.epc.length > 0 ? 'S' : 'N'}</utilizEpc>
            <eficEpc>${ghe.epc.some(e => e.eficaz) ? 'S' : 'N'}</eficEpc>
            <utilizEpi>${ghe.epi.length > 0 ? 'S' : 'N'}</utilizEpi>
            <eficEpi>${ghe.epi.some(e => e.eficaz) ? 'S' : 'N'}</eficEpi>
            ${ghe.epi.map(e => `
            <epi>
              <caEPI>${e.ca.replace(/\D/g, '')}</caEPI>
              <dscEPI>${e.nome}</dscEPI>
            </epi>`).join('')}
          </epcEpi>
        </agNoc>`
    }).join('')

    return `
      <infoAtiv>
        <dscAtivDes>${ghe.nome}</dscAtivDes>
        ${agentesXML}
        <respReg>
          <ideResponsavel>
            <cpfResponsavel>${ltcat.resp_registro || ''}</cpfResponsavel>
          </ideResponsavel>
        </respReg>
      </infoAtiv>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_03_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <evtExpRisco Id="ID${cnpjSemMascara(empresa.cnpj)}${Date.now()}">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjSemMascara(empresa.cnpj)}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${cpfSemMascara(func.cpf)}</cpfTrab>
      <matricula>${func.matricula_esocial}</matricula>
    </ideVinculo>
    <infoExpRisco>
      <iniValid>${dataESocial(ltcat.data_vigencia).slice(0, 7)}</iniValid>
      ${gheXML}
      <respReg>
        <ideResponsavel>
          <nmRespReg>${ltcat.resp_nome}</nmRespReg>
          <ideOC>${ltcat.resp_conselho || 'CREA'}</ideOC>
          <nrOC>${ltcat.resp_registro || ''}</nrOC>
        </ideResponsavel>
      </respReg>
    </infoExpRisco>
  </evtExpRisco>
</eSocial>`
}

// ─── S-2210: COMUNICAÇÃO DE ACIDENTE DE TRABALHO ─────────
export function gerarXML_S2210(
  cat: CAT,
  func: Funcionario,
  empresa: Empresa
): string {
  const tipoCatMap: Record<string, string> = { tipico: '1', trajeto: '3', doenca: '2' }
  const atend = cat.atendimento as { unidade?: string; data?: string; hora?: string; medico?: string; crm?: string; tipo?: string }

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtCAT/v_S_01_03_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <evtCAT Id="ID${cnpjSemMascara(empresa.cnpj)}${Date.now()}">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjSemMascara(empresa.cnpj)}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${cpfSemMascara(func.cpf)}</cpfTrab>
      <matricula>${func.matricula_esocial}</matricula>
    </ideVinculo>
    <cat>
      <dtAcid>${dataESocial(cat.dt_acidente)}</dtAcid>
      ${cat.hora_acidente ? `<hrAcid>${cat.hora_acidente}</hrAcid>` : ''}
      <tpAcid>${tipoCatMap[cat.tipo_cat] || '1'}</tpAcid>
      <dscLesao>${cat.natureza_lesao || ''}</dscLesao>
      <dscCompLesao>${cat.descricao || ''}</dscCompLesao>
      <diagProvavel>${cat.cid}</diagProvavel>
      <codCID>${cat.cid}</codCID>
      <ideLocalAcidente>
        <dscLocal>${cat.agente_causador || ''}</dscLocal>
      </ideLocalAcidente>
      ${cat.houve_morte ? '<infoObito><dtObito>9999-12-31</dtObito></infoObito>' : ''}
      ${cat.dias_afastamento ? `<infoAfastamento><dtIniAfast>${dataESocial(cat.dt_acidente)}</dtIniAfast></infoAfastamento>` : ''}
      <atendimento>
        <dtAtendimento>${atend.data ? dataESocial(atend.data) : dataESocial(cat.dt_acidente)}</dtAtendimento>
        ${atend.hora ? `<hrAtendimento>${atend.hora}</hrAtendimento>` : ''}
        <nmMedico>${atend.medico || ''}</nmMedico>
        <nrCRM>${(atend.crm || '').replace(/\D/g, '')}</nrCRM>
        <ufCRM>${(atend.crm || '').split('-').pop()?.trim() || 'SP'}</ufCRM>
      </atendimento>
    </cat>
  </evtCAT>
</eSocial>`
}

// ─── VALIDAÇÃO BÁSICA ANTES DE GERAR ─────────────────────
export function validarDadosS2220(aso: ASO, func: Funcionario): string[] {
  const erros: string[] = []
  if (!func.cpf) erros.push('CPF do trabalhador é obrigatório')
  if (!func.matricula_esocial) erros.push('Matrícula eSocial é obrigatória')
  if (!aso.data_exame) erros.push('Data do exame é obrigatória')
  if (!aso.conclusao) erros.push('Conclusão do ASO é obrigatória')
  if (!aso.medico_crm) erros.push('CRM do médico é obrigatório')
  if (!aso.exames || (aso.exames as unknown[]).length === 0) erros.push('Ao menos um exame é obrigatório')
  return erros
}

export function validarDadosS2210(cat: CAT, func: Funcionario): string[] {
  const erros: string[] = []
  if (!func.cpf) erros.push('CPF do trabalhador é obrigatório')
  if (!cat.dt_acidente) erros.push('Data do acidente é obrigatória')
  if (!cat.cid) erros.push('CID-10 é obrigatório')
  if (!cat.tipo_cat) erros.push('Tipo de CAT é obrigatório')
  return erros
}
