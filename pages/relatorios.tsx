import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const EVT_COR = { 'S-2210':['#FCEBEB','#791F1F'], 'S-2220':['#E6F1FB','#0C447C'], 'S-2240':['#FAEEDA','#633806'] }
const ST_COR  = { enviado:['#EAF3DE','#27500A'], pendente:['#FAEEDA','#633806'], rejeitado:['#FCEBEB','#791F1F'], cancelado:['#f3f4f6','#6b7280'] }
const ST_LBL  = { enviado:'Enviado', pendente:'Pendente', rejeitado:'Rejeitado', cancelado:'Cancelado' }
const MESES   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function Relatorios() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [confirmExcluir, setConfirmExcluir] = useState(null)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')
  const [transmitindo, setTransmitindo] = useState(false)

  // Filtros
  const [filtroEvt, setFiltroEvt] = useState('')
  const [filtroSt, setFiltroSt] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroAno, setFiltroAno] = useState('')
  const [busca, setBusca] = useState('')

  const anoAtual = new Date().getFullYear()
  const anos = [anoAtual, anoAtual-1, anoAtual-2]

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresaId(user.empresa_id)
    await carregar(user.empresa_id)
    setCarregando(false)
  }

  async function carregar(eId) {
    const { data } = await supabase.from('transmissoes')
      .select('id,evento,status,dt_envio,recibo,tentativas,criado_em,erro_descricao,funcionario_id,funcionarios(nome,matricula_esocial,cpf)')
      .eq('empresa_id', eId)
      .order('criado_em', { ascending: false })
      .limit(500)
    setLista(data || [])
  }

  async function excluir(id) {
    const { error } = await supabase.from('transmissoes').delete().eq('id', id)
    if (error) { setErro('Erro: ' + error.message); return }
    setSucesso('Excluída.')
    setConfirmExcluir(null)
    carregar(empresaId)
  }

  async function transmitir(tx) {
    setTransmitindo(true)
    router.push('/transmissao-manual')
    setTransmitindo(false)
  }

  // Filtros aplicados
  const listaFiltrada = lista.filter(tx => {
    if (filtroEvt && tx.evento !== filtroEvt) return false
    if (filtroSt  && tx.status !== filtroSt)  return false
    if (filtroAno) {
      const ano = new Date(tx.criado_em).getFullYear().toString()
      if (ano !== filtroAno) return false
    }
    if (filtroMes) {
      const mes = (new Date(tx.criado_em).getMonth() + 1).toString().padStart(2,'0')
      if (mes !== filtroMes) return false
    }
    if (busca) {
      const b = busca.toLowerCase()
      if (!tx.funcionarios?.nome?.toLowerCase().includes(b) &&
          !tx.funcionarios?.cpf?.toLowerCase().includes(b) &&
          !tx.recibo?.toLowerCase().includes(b)) return false
    }
    return true
  })

  // Totalizadores
  const totais = {
    total:    listaFiltrada.length,
    enviados: listaFiltrada.filter(t=>t.status==='enviado').length,
    pendente: listaFiltrada.filter(t=>t.status==='pendente').length,
    rejeit:   listaFiltrada.filter(t=>t.status==='rejeitado').length,
  }

  function fmtData(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
  }

  if (carregando) return <div style={s.loading}>Carregando...</div>

  return (
    <Layout pagina="relatorios">
      <Head><title>Relatórios — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>Relatórios de Transmissão</div>
          <div style={s.sub}>Histórico completo de todos os eventos SST</div>
        </div>
        <button style={s.btnPrimary} onClick={() => router.push('/transmissao-manual')}>
          📡 Transmitir pendentes
        </button>
      </div>

      {sucesso && <div style={s.sucessoBox}>{sucesso}</div>}
      {erro    && <div style={s.erroBox}>{erro}</div>}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        {[
          { n:totais.total,    l:'Total filtrado',  c:'#185FA5' },
          { n:totais.enviados, l:'Enviados',         c:'#1D9E75' },
          { n:totais.pendente, l:'Pendentes',        c:'#EF9F27' },
          { n:totais.rejeit,   l:'Rejeitados',       c:'#E24B4A' },
        ].map((k,i) => (
          <div key={i} style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:22, fontWeight:700, color:k.c }}>{k.n}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, padding:'12px 14px', marginBottom:14, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <input style={{ ...s.input, width:220 }} placeholder="Buscar nome, CPF ou recibo..."
          value={busca} onChange={e => setBusca(e.target.value)} />

        <select style={{ ...s.input, width:140 }} value={filtroEvt} onChange={e => setFiltroEvt(e.target.value)}>
          <option value="">Todos eventos</option>
          <option value="S-2220">S-2220 Monit. Saúde</option>
          <option value="S-2240">S-2240 Cond. Ambientais</option>
          <option value="S-2210">S-2210 CAT</option>
        </select>

        <select style={{ ...s.input, width:130 }} value={filtroSt} onChange={e => setFiltroSt(e.target.value)}>
          <option value="">Todos status</option>
          <option value="enviado">Enviado</option>
          <option value="pendente">Pendente</option>
          <option value="rejeitado">Rejeitado</option>
        </select>

        <select style={{ ...s.input, width:100 }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
          <option value="">Todos anos</option>
          {anos.map(a => <option key={a} value={String(a)}>{a}</option>)}
        </select>

        <select style={{ ...s.input, width:110 }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
          <option value="">Todos meses</option>
          {MESES.map((m,i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
        </select>

        {(filtroEvt||filtroSt||filtroMes||filtroAno||busca) && (
          <button style={{ ...s.btnOutline, padding:'6px 12px', fontSize:12 }}
            onClick={() => { setFiltroEvt(''); setFiltroSt(''); setFiltroMes(''); setFiltroAno(''); setBusca('') }}>
            ✕ Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f9fafb' }}>
              {['Evento','Funcionário','Criado em','Enviado em','Recibo','Status','Erro','Ações'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:'2rem', color:'#9ca3af', fontSize:13 }}>
                Nenhum resultado com os filtros aplicados.
              </td></tr>
            ) : listaFiltrada.map(tx => {
              const [evBg,evCor] = EVT_COR[tx.evento]||['#f3f4f6','#374151']
              const [stBg,stCor] = ST_COR[tx.status]||['#f3f4f6','#374151']
              return (
                <tr key={tx.id} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                  <td style={s.td}>
                    <span style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700, background:evBg, color:evCor }}>
                      {tx.evento}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={{ fontWeight:500, fontSize:12 }}>{tx.funcionarios?.nome||'—'}</div>
                    <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>{tx.funcionarios?.matricula_esocial||''}</div>
                  </td>
                  <td style={{ ...s.td, fontSize:11, color:'#6b7280', whiteSpace:'nowrap' }}>{fmtData(tx.criado_em)}</td>
                  <td style={{ ...s.td, fontSize:11, color:'#6b7280', whiteSpace:'nowrap' }}>{fmtData(tx.dt_envio)}</td>
                  <td style={{ ...s.td, fontSize:10, fontFamily:'monospace', color:'#6b7280', maxWidth:100 }}>
                    {tx.recibo ? tx.recibo.substring(0,14)+'...' : '—'}
                  </td>
                  <td style={s.td}>
                    <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:stBg, color:stCor }}>
                      {ST_LBL[tx.status]||tx.status}
                    </span>
                  </td>
                  <td style={{ ...s.td, maxWidth:160 }}>
                    {tx.erro_descricao ? (
                      <span style={{ fontSize:11, color:'#791F1F' }} title={tx.erro_descricao}>
                        {tx.erro_descricao.substring(0,40)}{tx.erro_descricao.length>40?'...':''}
                      </span>
                    ) : <span style={{ color:'#d1d5db', fontSize:11 }}>—</span>}
                  </td>
                  <td style={s.td}>
                    <div style={{ display:'flex', gap:5 }}>
                      {tx.status === 'pendente' && (
                        <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }}
                          onClick={() => transmitir(tx)}>Enviar</button>
                      )}
                      {tx.status === 'rejeitado' && (
                        <button style={{ ...s.btnAcao, color:'#EF9F27', borderColor:'#FAC775' }}
                          onClick={() => transmitir(tx)}>Retransmitir</button>
                      )}
                      <button style={{ ...s.btnAcao, color:'#E24B4A', borderColor:'#F09595' }}
                        onClick={() => setConfirmExcluir(tx)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal excluir */}
      {confirmExcluir && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ fontSize:14, fontWeight:600, color:'#111', marginBottom:8 }}>Confirmar exclusão</div>
            <div style={{ fontSize:13, color:'#374151', marginBottom:14, lineHeight:1.6 }}>
              Excluir transmissão <strong>{confirmExcluir.evento}</strong> de <strong>{confirmExcluir.funcionarios?.nome||'—'}</strong>?
              {confirmExcluir.status==='enviado' && (
                <div style={{ marginTop:8, color:'#E24B4A', fontSize:12, background:'#FCEBEB', padding:'8px', borderRadius:6 }}>
                  ⚠ Já foi enviada ao Gov.br. A exclusão é apenas local.
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...s.btnOutline, color:'#E24B4A', borderColor:'#F09595' }} onClick={() => excluir(confirmExcluir.id)}>Confirmar</button>
              <button style={s.btnOutline} onClick={() => setConfirmExcluir(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

const s = {
  loading:    { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' },
  header:     { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' },
  titulo:     { fontSize:20, fontWeight:700, color:'#111' },
  sub:        { fontSize:12, color:'#6b7280', marginTop:2 },
  th:         { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'0.5px solid #e5e7eb', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' },
  td:         { padding:'10px 12px', verticalAlign:'middle', color:'#374151' },
  input:      { padding:'7px 10px', fontSize:12, border:'1px solid #d1d5db', borderRadius:7, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' },
  btnAcao:    { padding:'3px 10px', fontSize:11, background:'transparent', border:'0.5px solid #d1d5db', borderRadius:6, cursor:'pointer', color:'#374151', whiteSpace:'nowrap' },
  btnPrimary: { padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnOutline: { padding:'8px 14px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', color:'#374151' },
  erroBox:    { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  sucessoBox: { background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modal:      { background:'#fff', borderRadius:12, padding:'1.5rem', width:420, boxShadow:'0 20px 60px rgba(0,0,0,0.15)' },
}
