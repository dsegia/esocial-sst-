import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function S2220() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [funcionarios, setFuncionarios] = useState([])
  const [asos, setAsos] = useState([])
  const [transmissoes, setTransmissoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [transmitindo, setTransmitindo] = useState(false)
  const [selecionados, setSelecionados] = useState([])
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresaId(user.empresa_id)

    const [funcsRes, asosRes, txRes] = await Promise.all([
      supabase.from('funcionarios').select('id,nome,cpf,matricula_esocial,funcao,setor,data_adm,data_nasc').eq('empresa_id', user.empresa_id).eq('ativo', true).order('nome'),
      supabase.from('asos').select('*').eq('empresa_id', user.empresa_id).order('data_exame', { ascending: false }),
      supabase.from('transmissoes').select('id,status,evento,funcionario_id,recibo,dt_envio,criado_em').eq('empresa_id', user.empresa_id).eq('evento', 'S-2220').order('criado_em', { ascending: false }),
    ])

    setFuncionarios(funcsRes.data || [])
    setAsos(asosRes.data || [])
    setTransmissoes(txRes.data || [])
    setCarregando(false)
  }

  function ultimoAso(funcId) {
    return asos.filter(a => a.funcionario_id === funcId).sort((a,b) => new Date(b.data_exame)-new Date(a.data_exame))[0] || null
  }

  function ultimaTx(funcId) {
    return transmissoes.filter(t => t.funcionario_id === funcId)[0] || null
  }

  function statusFuncionario(func) {
    const aso = ultimoAso(func.id)
    const tx  = ultimaTx(func.id)
    const dadosOk = func.data_adm && func.data_nasc && func.matricula_esocial && !func.matricula_esocial.startsWith('PEND-')

    if (!aso) return { label:'Sem ASO', cor:'#E24B4A', bg:'#FCEBEB', pode:false, motivo:'Sem ASO cadastrado' }
    if (!dadosOk) return { label:'Dados incompletos', cor:'#EF9F27', bg:'#FAEEDA', pode:false, motivo:'Faltam: admissão, nascimento ou matrícula eSocial' }

    const dias = aso.prox_exame ? Math.round((new Date(aso.prox_exame)-new Date())/86400000) : null
    if (dias !== null && dias < 0) return { label:'ASO vencido', cor:'#E24B4A', bg:'#FCEBEB', pode:true, motivo:'ASO vencido — transmissão pendente' }

    if (!tx) return { label:'Pendente envio', cor:'#EF9F27', bg:'#FAEEDA', pode:true, motivo:'ASO cadastrado mas não transmitido' }
    if (tx.status === 'enviado') return { label:'Transmitido', cor:'#1D9E75', bg:'#EAF3DE', pode:false, motivo:`Recibo: ${tx.recibo||'—'}` }
    if (tx.status === 'pendente') return { label:'Aguardando', cor:'#EF9F27', bg:'#FAEEDA', pode:true, motivo:'Transmissão pendente' }
    if (tx.status === 'rejeitado') return { label:'Rejeitado', cor:'#E24B4A', bg:'#FCEBEB', pode:true, motivo:'Transmissão rejeitada — corrigir e retransmitir' }

    return { label:'Em dia', cor:'#1D9E75', bg:'#EAF3DE', pode:false, motivo:'' }
  }

  const funcsFiltradas = funcionarios.filter(f => {
    const st = statusFuncionario(f)
    if (filtro === 'todos') return true
    if (filtro === 'pendente') return st.pode
    if (filtro === 'ok') return !st.pode && st.label === 'Transmitido'
    if (filtro === 'problema') return st.label === 'Sem ASO' || st.label === 'Dados incompletos' || st.label === 'Rejeitado'
    return true
  })

  const prontos = funcionarios.filter(f => statusFuncionario(f).pode)

  async function transmitirSelecionados(ids) {
    if (!ids.length) return
    setTransmitindo(true); setErro(''); setSucesso('')
    // Buscar transmissões pendentes desses funcionários
    const { data: txsPendentes } = await supabase.from('transmissoes')
      .select('id').eq('evento', 'S-2220').eq('status', 'pendente').in('funcionario_id', ids)
    if (!txsPendentes?.length) {
      setErro('Nenhuma transmissão pendente para os selecionados.')
      setTransmitindo(false); return
    }
    router.push('/transmissao-manual')
    setTransmitindo(false)
  }

  if (carregando) return <div style={s.loading}>Carregando...</div>

  return (
    <Layout pagina="s2220">
      <Head><title>S-2220 — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>S-2220 — Monitoramento da Saúde do Trabalhador</div>
          <div style={s.sub}>{prontos.length} funcionário(s) com transmissão pendente</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={s.btnOutline} onClick={() => router.push('/leitor')}>↑ Importar ASO</button>
          <button style={s.btnPrimary} onClick={() => transmitirSelecionados(prontos.map(f=>f.id))} disabled={!prontos.length || transmitindo}>
            📡 Transmitir todos prontos ({prontos.length})
          </button>
        </div>
      </div>

      {sucesso && <div style={s.sucessoBox}>{sucesso}</div>}
      {erro    && <div style={s.erroBox}>{erro}</div>}

      {/* Filtros */}
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { k:'todos',    l:`Todos (${funcionarios.length})` },
          { k:'pendente', l:`Prontos para transmitir (${funcionarios.filter(f=>statusFuncionario(f).pode).length})` },
          { k:'ok',       l:`Transmitidos (${funcionarios.filter(f=>statusFuncionario(f).label==='Transmitido').length})` },
          { k:'problema', l:`Com problema (${funcionarios.filter(f=>['Sem ASO','Dados incompletos','Rejeitado'].includes(statusFuncionario(f).label)).length})` },
        ].map(f => (
          <button key={f.k} onClick={() => setFiltro(f.k)} style={{
            padding:'5px 12px', fontSize:12, fontWeight:500, borderRadius:99, cursor:'pointer', border:'none',
            background: filtro===f.k?'#185FA5':'#f3f4f6', color: filtro===f.k?'#fff':'#374151',
          }}>{f.l}</button>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f9fafb' }}>
              {['Funcionário','Matrícula','Último ASO','Próximo exame','Última transmissão','Status','Ações'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funcsFiltradas.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:'2rem', color:'#9ca3af', fontSize:13 }}>
                Nenhum funcionário neste filtro.
              </td></tr>
            ) : funcsFiltradas.map(f => {
              const aso = ultimoAso(f.id)
              const tx  = ultimaTx(f.id)
              const st  = statusFuncionario(f)
              return (
                <tr key={f.id} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                  <td style={s.td}>
                    <div style={{ fontWeight:500 }}>{f.nome}</div>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>{f.funcao||'—'} · {f.setor||'—'}</div>
                  </td>
                  <td style={{ ...s.td, fontFamily:'monospace', fontSize:11 }}>
                    {f.matricula_esocial?.startsWith('PEND-') ? <span style={{ color:'#EF9F27' }}>Pendente</span> : f.matricula_esocial||'—'}
                  </td>
                  <td style={s.td}>
                    {aso ? (
                      <div>
                        <div style={{ fontSize:12 }}>{new Date(aso.data_exame+'T12:00:00').toLocaleDateString('pt-BR')}</div>
                        <div style={{ fontSize:10, color:'#9ca3af' }}>{aso.tipo_aso} · {aso.conclusao}</div>
                      </div>
                    ) : <span style={{ color:'#E24B4A', fontSize:12 }}>Sem ASO</span>}
                  </td>
                  <td style={s.td}>
                    {aso?.prox_exame ? (
                      <span style={{ fontSize:12, color: new Date(aso.prox_exame)<new Date()?'#E24B4A':'#374151' }}>
                        {new Date(aso.prox_exame+'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    ) : <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>}
                  </td>
                  <td style={s.td}>
                    {tx ? (
                      <div>
                        <div style={{ fontSize:11 }}>{new Date(tx.criado_em).toLocaleDateString('pt-BR')}</div>
                        <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>{tx.recibo ? tx.recibo.substring(0,12)+'...' : '—'}</div>
                      </div>
                    ) : <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>}
                  </td>
                  <td style={s.td}>
                    <div>
                      <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:st.bg, color:st.cor }}>
                        {st.label}
                      </span>
                      {st.motivo && <div style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>{st.motivo}</div>}
                    </div>
                  </td>
                  <td style={s.td}>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {st.pode && (
                        <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }}
                          onClick={() => router.push('/transmissao-manual')}>
                          Transmitir
                        </button>
                      )}
                      <button style={s.btnAcao} onClick={() => router.push(`/leitor`)}>
                        Novo ASO
                      </button>
                      {st.label === 'Dados incompletos' && (
                        <button style={{ ...s.btnAcao, color:'#EF9F27', borderColor:'#FAC775' }}
                          onClick={() => router.push('/funcionarios')}>
                          Completar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

const s = {
  loading:    { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' },
  header:     { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' },
  titulo:     { fontSize:18, fontWeight:700, color:'#111' },
  sub:        { fontSize:12, color:'#6b7280', marginTop:2 },
  th:         { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'0.5px solid #e5e7eb', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' },
  td:         { padding:'10px 12px', verticalAlign:'top', color:'#374151' },
  btnAcao:    { padding:'3px 10px', fontSize:11, background:'transparent', border:'0.5px solid #d1d5db', borderRadius:6, cursor:'pointer', color:'#374151', whiteSpace:'nowrap' },
  btnPrimary: { padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnOutline: { padding:'8px 14px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', color:'#374151' },
  erroBox:    { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  sucessoBox: { background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
}
