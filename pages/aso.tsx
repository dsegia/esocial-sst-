import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { getEmpresaId } from '../lib/empresa'
import { gerarPdfAso } from '../lib/gerar-pdf'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TIPO_LABEL: Record<string,string> = {
  admissional:'Admissional', periodico:'Periódico', retorno:'Retorno ao trabalho',
  mudanca:'Mudança de função', demissional:'Demissional', monitoracao:'Monitoração pontual',
}

const CONCL_COR: Record<string,string[]> = {
  apto:           ['#EAF3DE','#27500A'],
  apto_restricao: ['#FAEEDA','#633806'],
  inapto:         ['#FCEBEB','#791F1F'],
}

// Tabela 27 do eSocial — principais exames
const EXAMES_ESOCIAL = [
  { codigo: '001', nome: 'Acuidade visual' },
  { codigo: '002', nome: 'Audiometria tonal e vocal' },
  { codigo: '003', nome: 'Eletrocardiograma (ECG)' },
  { codigo: '004', nome: 'Eletroencefalograma (EEG)' },
  { codigo: '005', nome: 'Espirometria' },
  { codigo: '006', nome: 'Exame clínico' },
  { codigo: '007', nome: 'Hemograma completo' },
  { codigo: '008', nome: 'Glicemia em jejum' },
  { codigo: '009', nome: 'Colesterol total e frações' },
  { codigo: '010', nome: 'Triglicerídeos' },
  { codigo: '011', nome: 'Ureia' },
  { codigo: '012', nome: 'Creatinina' },
  { codigo: '013', nome: 'Transaminases (TGO/TGP)' },
  { codigo: '014', nome: 'Gama-GT' },
  { codigo: '015', nome: 'Fosfatase alcalina' },
  { codigo: '016', nome: 'Ácido úrico' },
  { codigo: '017', nome: 'Bilirrubinas (total e frações)' },
  { codigo: '018', nome: 'Urina tipo I (EAS)' },
  { codigo: '019', nome: 'Parasitológico de fezes' },
  { codigo: '020', nome: 'Radiografia de tórax' },
  { codigo: '021', nome: 'Avaliação psicológica' },
  { codigo: '022', nome: 'Avaliação neurológica' },
  { codigo: '023', nome: 'HBsAg (Hepatite B)' },
  { codigo: '024', nome: 'VDRL (Sífilis)' },
  { codigo: '025', nome: 'Anti-HIV' },
  { codigo: '026', nome: 'Exame dermatológico' },
  { codigo: '027', nome: 'Avaliação ortopédica' },
  { codigo: '028', nome: 'Avaliação cardiológica' },
  { codigo: '029', nome: 'Doppler vascular' },
  { codigo: '030', nome: 'Fundoscopia' },
  { codigo: '031', nome: 'Chumbo no sangue (plumbemia)' },
  { codigo: '032', nome: 'Mercúrio na urina' },
  { codigo: '033', nome: 'Benzeno no sangue' },
  { codigo: '034', nome: 'Colinesterase eritrocitária' },
  { codigo: '035', nome: 'Proteína C reativa (PCR)' },
  { codigo: '036', nome: 'TSH / T4 livre' },
  { codigo: '037', nome: 'Densitometria óssea' },
  { codigo: '038', nome: 'Mamografia' },
  { codigo: '039', nome: 'Avaliação ginecológica' },
  { codigo: '040', nome: 'PSA (antígeno prostático)' },
  { codigo: '099', nome: 'Outros' },
]

// Tenta achar o código eSocial pelo nome do exame (matching parcial)
function codigoDeExame(nome: string): string {
  const n = nome.toLowerCase()
  const match = EXAMES_ESOCIAL.find(e =>
    n.includes(e.nome.toLowerCase().split(' ')[0]) ||
    e.nome.toLowerCase().includes(n.split(' ')[0])
  )
  return match?.codigo || '099'
}

export default function Aso() {
  const router = useRouter()
  const [_empresaId, setEmpresaId] = useState('')
  const [asos, setAsos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  // Modal editar
  const [editando, setEditando] = useState<any>(null)   // aso completo
  const [abaModal, setAbaModal] = useState<'dados'|'exames'>('dados')
  const [formFunc, setFormFunc] = useState<any>({})
  const [formExames, setFormExames] = useState<any[]>([])
  const [novoExameCodigo, setNovoExameCodigo] = useState('')
  const [novoExameResultado, setNovoExameResultado] = useState<'Normal'|'Alterado'|'Pendente'>('Normal')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: user } = await supabase.from('usuarios')
      .select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/login'); return }
    const empId = getEmpresaId() || user.empresa_id
    setEmpresaId(empId)

    const { data } = await supabase
      .from('asos')
      .select('*, funcionarios(id, nome, cpf, funcao, setor, matricula_esocial, data_nasc, data_adm, ativo)')
      .eq('empresa_id', empId)
      .not('funcionario_id', 'is', null)
      .order('data_exame', { ascending: false })

    setAsos(data || [])
    setCarregando(false)
  }

  function abrirEditar(aso: any) {
    const f = aso.funcionarios || {}
    setFormFunc({
      nome:              f.nome || '',
      cpf:               f.cpf || '',
      data_nasc:         f.data_nasc || '',
      data_adm:          f.data_adm || '',
      matricula_esocial: f.matricula_esocial?.startsWith('PEND-') ? '' : (f.matricula_esocial || ''),
      funcao:            f.funcao || '',
      setor:             f.setor || '',
    })
    // Normaliza exames: garante array e adiciona código eSocial se faltando
    const exames = (aso.exames || []).map((e: any) => ({
      ...e,
      codigo: e.codigo || codigoDeExame(e.nome),
    }))
    setFormExames(exames)
    setNovoExameCodigo(EXAMES_ESOCIAL[0].codigo)
    setNovoExameResultado('Normal')
    setAbaModal('dados')
    setEditando(aso)
    setSucesso('')
    setErro('')
  }

  async function salvarDadosFunc() {
    if (!editando?.funcionarios?.id) return
    setSalvando(true)
    const { error } = await supabase.from('funcionarios').update({
      nome:              formFunc.nome,
      cpf:               formFunc.cpf,
      data_nasc:         formFunc.data_nasc || null,
      data_adm:          formFunc.data_adm || null,
      matricula_esocial: formFunc.matricula_esocial || ('PEND-' + Date.now()),
      funcao:            formFunc.funcao || null,
      setor:             formFunc.setor || null,
    }).eq('id', editando.funcionarios.id)
    if (error) setErro('Erro ao salvar funcionário: ' + error.message)
    else { setSucesso('Dados do funcionário salvos!'); await init() }
    setSalvando(false)
  }

  async function salvarExames() {
    setSalvando(true)
    const { error } = await supabase.from('asos').update({
      exames: formExames,
    }).eq('id', editando.id)
    if (error) setErro('Erro ao salvar exames: ' + error.message)
    else { setSucesso('Exames atualizados!'); await init() }
    setSalvando(false)
  }

  function adicionarExame() {
    const item = EXAMES_ESOCIAL.find(e => e.codigo === novoExameCodigo)
    if (!item) return
    // Não duplica pelo código
    if (formExames.some(e => e.codigo === novoExameCodigo)) {
      setErro('Exame já adicionado.'); return
    }
    setFormExames(prev => [...prev, { codigo: item.codigo, nome: item.nome, resultado: novoExameResultado }])
    setErro('')
  }

  function removerExame(idx: number) {
    setFormExames(prev => prev.filter((_, i) => i !== idx))
  }

  function atualizarResultado(idx: number, resultado: string) {
    setFormExames(prev => prev.map((e, i) => i === idx ? { ...e, resultado } : e))
  }

  async function excluirAso(id: string) {
    if (!confirm('Excluir este ASO?')) return
    await supabase.from('asos').delete().eq('id', id)
    setAsos(prev => prev.filter(a => a.id !== id))
  }

  function diasParaVencer(d: string | null) {
    if (!d) return null
    return Math.round((new Date(d).getTime() - Date.now()) / 86400000)
  }

  function statusAso(aso: any) {
    const dias = diasParaVencer(aso.prox_exame)
    if (dias === null) return { label:'Sem próximo exame', cor:'#9ca3af', bg:'#f3f4f6' }
    if (dias < 0)      return { label:`Vencido há ${Math.abs(dias)}d`, cor:'#E24B4A', bg:'#FCEBEB' }
    if (dias <= 30)    return { label:`Vence em ${dias}d`, cor:'#EF9F27', bg:'#FAEEDA' }
    if (dias <= 90)    return { label:`Vence em ${dias}d`, cor:'#185FA5', bg:'#E6F1FB' }
    return { label:'Em dia', cor:'#1D9E75', bg:'#EAF3DE' }
  }

  const asosFiltrados = asos.filter(a => {
    if (filtro === 'todos')    return true
    const dias = diasParaVencer(a.prox_exame)
    if (filtro === 'validos')  return dias !== null && dias >= 0
    if (filtro === 'vencidos') return dias !== null && dias < 0
    if (filtro === 'sem_prox') return dias === null
    return true
  })

  const totalVencidos = asos.filter(a => { const d = diasParaVencer(a.prox_exame); return d !== null && d < 0 }).length
  const totalVence30  = asos.filter(a => { const d = diasParaVencer(a.prox_exame); return d !== null && d >= 0 && d <= 30 }).length
  const totalEmDia    = asos.filter(a => { const d = diasParaVencer(a.prox_exame); return d !== null && d > 30 }).length

  if (carregando) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' }}>
      Carregando...
    </div>
  )

  const fmtData = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

  return (
    <Layout pagina="aso">
      <Head><title>ASO — eSocial SST</title></Head>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'#111' }}>ASO — Atestados de Saúde Ocupacional</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
            {asos.length} atestado(s) · {totalVencidos} vencido(s) · {totalVence30} vencem em 30 dias
          </div>
        </div>
        <button onClick={() => router.push('/importar')}
          style={{ padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
          ↑ Importar ASO
        </button>
      </div>

      {sucesso && <div style={s.sucessoBox}>{sucesso}</div>}
      {erro    && <div style={s.erroBox}>{erro}</div>}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'Total importados', valor:asos.length,     cor:'#185FA5', bg:'#f9fafb' },
          { label:'Em dia',           valor:totalEmDia,       cor:'#1D9E75', bg:'#EAF3DE' },
          { label:'Vencem em 30d',    valor:totalVence30,     cor:'#EF9F27', bg:'#FAEEDA' },
          { label:'Vencidos',         valor:totalVencidos,    cor:'#E24B4A', bg:'#FCEBEB' },
        ].map((k,i) => (
          <div key={i} style={{ background:k.bg, border:`0.5px solid ${k.cor}33`, borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:22, fontWeight:800, color:k.cor }}>{k.valor}</div>
            <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[
          { key:'todos',    label:`Todos (${asos.length})` },
          { key:'validos',  label:`Em dia (${totalEmDia + totalVence30})` },
          { key:'vencidos', label:`Vencidos (${totalVencidos})` },
          { key:'sem_prox', label:`Sem próximo (${asos.filter(a => diasParaVencer(a.prox_exame) === null).length})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            style={{ padding:'5px 12px', fontSize:11, fontWeight:filtro===f.key?600:400, borderRadius:99, border:'0.5px solid',
              cursor:'pointer',
              borderColor: filtro===f.key ? '#185FA5' : '#e5e7eb',
              background:  filtro===f.key ? '#185FA5' : '#fff',
              color:       filtro===f.key ? '#fff' : '#374151',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {asosFiltrados.length === 0 ? (
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'3rem', textAlign:'center', color:'#9ca3af' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
          <div style={{ fontSize:14, fontWeight:500, color:'#374151', marginBottom:6 }}>Nenhum ASO encontrado</div>
          <div style={{ fontSize:12, marginBottom:16 }}>Importe atestados de saúde via PDF</div>
          <button onClick={() => router.push('/importar')}
            style={{ padding:'8px 18px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>
            ↑ Importar ASO
          </button>
        </div>
      ) : (
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#f9fafb', borderBottom:'0.5px solid #e5e7eb' }}>
                {['Funcionário','Cargo / Setor','Tipo ASO','Data exame','Próximo exame','Exames','Conclusão','Status','Ações'].map((h,i) => (
                  <th key={i} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {asosFiltrados.map((aso, i) => {
                const func = aso.funcionarios
                const st   = statusAso(aso)
                const [cBg, cTxt] = CONCL_COR[aso.conclusao] || ['#f3f4f6','#374151']
                const exames: any[] = aso.exames || []
                return (
                  <tr key={aso.id} style={{ borderBottom:'0.5px solid #f3f4f6', background: i%2===0?'#fff':'#fafafa' }}>

                    {/* Funcionário */}
                    <td style={s.td}>
                      <div style={{ fontWeight:500, color:'#111' }}>{func?.nome || '—'}</div>
                      <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>
                        {func?.matricula_esocial?.startsWith('PEND-') ? <span style={{ color:'#EF9F27' }}>Matrícula pendente</span> : func?.matricula_esocial}
                      </div>
                    </td>

                    {/* Cargo/Setor */}
                    <td style={s.td}>
                      <div style={{ color:'#374151' }}>{func?.funcao || '—'}</div>
                      {func?.setor && <div style={{ fontSize:10, color:'#9ca3af' }}>{func.setor}</div>}
                    </td>

                    {/* Tipo */}
                    <td style={s.td}>{TIPO_LABEL[aso.tipo_aso] || aso.tipo_aso || '—'}</td>

                    {/* Data exame */}
                    <td style={s.td}>{fmtData(aso.data_exame)}</td>

                    {/* Próximo */}
                    <td style={s.td}>{fmtData(aso.prox_exame)}</td>

                    {/* Exames */}
                    <td style={s.td}>
                      {exames.length > 0 ? (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                          {exames.slice(0,3).map((e, ei) => (
                            <span key={ei} style={{ padding:'1px 6px', borderRadius:99, fontSize:10, background:'#E6F1FB', color:'#0C447C', whiteSpace:'nowrap' }}>
                              {e.codigo || codigoDeExame(e.nome)} · {e.nome?.substring(0,14)}{e.nome?.length > 14 ? '…' : ''}
                            </span>
                          ))}
                          {exames.length > 3 && (
                            <span style={{ fontSize:10, color:'#9ca3af' }}>+{exames.length - 3}</span>
                          )}
                        </div>
                      ) : <span style={{ fontSize:11, color:'#9ca3af' }}>—</span>}
                    </td>

                    {/* Conclusão */}
                    <td style={s.td}>
                      <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600, background:cBg, color:cTxt }}>
                        {aso.conclusao === 'apto' ? 'Apto' : aso.conclusao === 'apto_restricao' ? 'Apto c/ restrição' : 'Inapto'}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={s.td}>
                      <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600, background:st.bg, color:st.cor }}>
                        {st.label}
                      </span>
                    </td>

                    {/* Ações */}
                    <td style={s.td}>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <button onClick={() => abrirEditar(aso)}
                          style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }}>
                          ✏ Editar
                        </button>
                        <button onClick={() => gerarPdfAso({ funcionario: aso.funcionarios, aso, exames: aso.exames, riscos: aso.riscos })}
                          style={{ ...s.btnAcao, color:'#27500A', borderColor:'#C0DD97' }}>
                          ↓ PDF
                        </button>
                        <button onClick={() => excluirAso(aso.id)}
                          style={{ ...s.btnAcao, color:'#E24B4A', borderColor:'#F09595' }}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal editar ──────────────────────────────────────────────────────── */}
      {editando && (
        <div style={s.overlay} onClick={() => setEditando(null)}>
          <div style={{ ...s.modal, width: 580 }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:'#111' }}>
                  Editar — {editando.funcionarios?.nome}
                </div>
                <div style={{ fontSize:11, color:'#9ca3af' }}>
                  ASO {TIPO_LABEL[editando.tipo_aso] || editando.tipo_aso} · {fmtData(editando.data_exame)}
                </div>
              </div>
              <button onClick={() => setEditando(null)}
                style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9ca3af' }}>×</button>
            </div>

            {sucesso && <div style={{ ...s.sucessoBox, marginBottom:12 }}>{sucesso}</div>}
            {erro    && <div style={{ ...s.erroBox,    marginBottom:12 }}>{erro}</div>}

            {/* Abas */}
            <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'0.5px solid #e5e7eb' }}>
              {(['dados', 'exames'] as const).map(aba => (
                <button key={aba} onClick={() => { setAbaModal(aba); setSucesso(''); setErro('') }}
                  style={{
                    padding:'7px 16px', fontSize:12, fontWeight:600, border:'none', cursor:'pointer',
                    background: 'transparent',
                    color: abaModal === aba ? '#185FA5' : '#9ca3af',
                    borderBottom: abaModal === aba ? '2px solid #185FA5' : '2px solid transparent',
                    marginBottom: -1,
                  }}>
                  {aba === 'dados' ? 'Dados do Funcionário' : `Exames (${formExames.length})`}
                </button>
              ))}
            </div>

            {/* Aba: dados */}
            {abaModal === 'dados' && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  {([
                    ['Nome completo','nome','text'],
                    ['CPF','cpf','text'],
                    ['Data de nascimento','data_nasc','date'],
                    ['Data de admissão','data_adm','date'],
                    ['Matrícula eSocial','matricula_esocial','text'],
                    ['Função / Cargo','funcao','text'],
                    ['Setor','setor','text'],
                  ] as [string,string,string][]).map(([label, field, type]) => (
                    <div key={field}>
                      <label style={s.label}>{label}</label>
                      <input style={s.input} type={type} value={formFunc[field] || ''}
                        onChange={e => setFormFunc((p: any) => ({ ...p, [field]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button style={s.btnPrimary} onClick={salvarDadosFunc} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar dados'}
                  </button>
                  <button style={s.btnOutline} onClick={() => setEditando(null)}>Fechar</button>
                </div>
              </>
            )}

            {/* Aba: exames */}
            {abaModal === 'exames' && (
              <>
                {/* Lista de exames */}
                <div style={{ marginBottom:14 }}>
                  {formExames.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'1.5rem', color:'#9ca3af', fontSize:12, background:'#f9fafb', borderRadius:8 }}>
                      Nenhum exame cadastrado. Adicione abaixo.
                    </div>
                  ) : (
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead>
                        <tr style={{ background:'#f9fafb' }}>
                          <th style={s.th}>Cód. eSocial</th>
                          <th style={s.th}>Exame</th>
                          <th style={s.th}>Resultado</th>
                          <th style={s.th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formExames.map((ex, idx) => (
                          <tr key={idx} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                            <td style={{ ...s.td, fontFamily:'monospace', fontWeight:600, color:'#185FA5' }}>
                              {ex.codigo || codigoDeExame(ex.nome)}
                            </td>
                            <td style={s.td}>{ex.nome}</td>
                            <td style={s.td}>
                              <select
                                value={ex.resultado}
                                onChange={e => atualizarResultado(idx, e.target.value)}
                                style={{ padding:'3px 6px', fontSize:11, border:'0.5px solid #d1d5db', borderRadius:5,
                                  background: ex.resultado === 'Normal' ? '#EAF3DE' : ex.resultado === 'Alterado' ? '#FCEBEB' : '#FAEEDA',
                                  color: ex.resultado === 'Normal' ? '#27500A' : ex.resultado === 'Alterado' ? '#791F1F' : '#633806',
                                  fontWeight:600, cursor:'pointer',
                                }}>
                                <option value="Normal">Normal</option>
                                <option value="Alterado">Alterado</option>
                                <option value="Pendente">Pendente</option>
                              </select>
                            </td>
                            <td style={s.td}>
                              <button onClick={() => removerExame(idx)}
                                style={{ ...s.btnAcao, color:'#E24B4A', borderColor:'#F09595' }}>
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Adicionar exame */}
                <div style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:8, padding:'12px 14px', marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#374151', marginBottom:8 }}>Adicionar exame</div>
                  <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                    <div style={{ flex:1 }}>
                      <label style={s.label}>Exame (Tabela 27)</label>
                      <select style={s.input} value={novoExameCodigo}
                        onChange={e => setNovoExameCodigo(e.target.value)}>
                        {EXAMES_ESOCIAL.map(e => (
                          <option key={e.codigo} value={e.codigo}>
                            {e.codigo} — {e.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width:120 }}>
                      <label style={s.label}>Resultado</label>
                      <select style={s.input} value={novoExameResultado}
                        onChange={e => setNovoExameResultado(e.target.value as any)}>
                        <option value="Normal">Normal</option>
                        <option value="Alterado">Alterado</option>
                        <option value="Pendente">Pendente</option>
                      </select>
                    </div>
                    <button onClick={adicionarExame}
                      style={{ ...s.btnPrimary, padding:'8px 14px', whiteSpace:'nowrap' }}>
                      + Adicionar
                    </button>
                  </div>
                </div>

                <div style={{ display:'flex', gap:8 }}>
                  <button style={s.btnPrimary} onClick={salvarExames} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar exames'}
                  </button>
                  <button style={s.btnOutline} onClick={() => setEditando(null)}>Fechar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}

const s: Record<string, any> = {
  th:         { padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' },
  td:         { padding:'9px 10px', verticalAlign:'top', color:'#374151' },
  label:      { display:'block', fontSize:11, fontWeight:500, color:'#374151', marginBottom:3 },
  input:      { width:'100%', padding:'7px 9px', fontSize:12, border:'1px solid #d1d5db', borderRadius:7, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' },
  btnAcao:    { padding:'3px 9px', fontSize:10, background:'transparent', border:'0.5px solid #d1d5db', borderRadius:6, cursor:'pointer', color:'#374151', whiteSpace:'nowrap' },
  btnPrimary: { padding:'8px 14px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer' },
  btnOutline: { padding:'8px 14px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:12, cursor:'pointer', color:'#374151' },
  erroBox:    { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  sucessoBox: { background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' },
  modal:      { background:'#fff', borderRadius:12, padding:'1.5rem', width:520, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' },
}
