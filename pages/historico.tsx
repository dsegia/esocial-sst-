import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { getEmpresaId } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const EVT_COR: Record<string, string[]> = { 'S-2210':['#FCEBEB','#791F1F'], 'S-2220':['#E6F1FB','#0C447C'], 'S-2240':['#FAEEDA','#633806'] }
const ST_COR: Record<string, string[]>  = { enviado:['#EAF3DE','#27500A'], pendente:['#FAEEDA','#633806'], rejeitado:['#FCEBEB','#791F1F'], cancelado:['#f3f4f6','#6b7280'] }
const ST_LBL: Record<string, string>    = { enviado:'Enviado', pendente:'Pendente', rejeitado:'Rejeitado', cancelado:'Cancelado' }

export default function Historico() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [lista, setLista] = useState<any[]>([])
  const [selecionados, setSelecionados] = useState<any[]>([])
  const [filtroEvt, setFiltroEvt] = useState('')
  const [filtroSt, setFiltroSt] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [confirmExcluir, setConfirmExcluir] = useState<any>(null)
  const [modoSelecao, setModoSelecao] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')
  const [temCertificado, setTemCertificado] = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    const { data:{ session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data:user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/login'); return }
    const empId = getEmpresaId() || user.empresa_id
    setEmpresaId(empId)

    // Verificar se empresa tem certificado digital
    const { data:empresa } = await supabase.from('empresas')
      .select('cert_digital_validade, cert_tipo')
      .eq('id', empId).single()
    setTemCertificado(!!empresa?.cert_digital_validade)

    await carregar(empId, '', '')
    setCarregando(false)
  }

  async function carregar(eId: string, evt: string, st: string) {
    let q = supabase.from('transmissoes')
      .select('id, evento, status, dt_envio, recibo, tentativas, criado_em, funcionario_id, funcionarios(nome, matricula_esocial)')
      .eq('empresa_id', eId)
      .order('criado_em', { ascending: false })
      .limit(100)
    if (evt) q = q.eq('evento', evt)
    if (st)  q = q.eq('status', st)
    const { data } = await q
    setLista(data || [])
    setSelecionados([])
  }

  async function excluir(id: string) {
    setErro(''); setSucesso('')
    const { error } = await supabase.from('transmissoes').delete().eq('id', id)
    if (error) { setErro('Erro ao excluir: ' + error.message); return }
    setSucesso('Transmissão excluída.')
    setConfirmExcluir(null)
    carregar(empresaId, filtroEvt, filtroSt)
  }

  async function excluirSelecionados() {
    if (!selecionados.length) return
    setErro(''); setSucesso('')
    const { error } = await supabase.from('transmissoes').delete().in('id', selecionados)
    if (error) { setErro('Erro ao excluir: ' + error.message); return }
    setSucesso(`${selecionados.length} transmissão(ões) excluída(s).`)
    setSelecionados([])
    setModoSelecao(false)
    carregar(empresaId, filtroEvt, filtroSt)
  }

  function transmitir(ids: string[]) {
    if (!temCertificado) {
      if (!confirm('Certificado digital não configurado. Deseja ir para as configurações?')) return
      router.push('/configuracoes')
      return
    }
    // Redireciona para a página de transmissão manual com o fluxo real (XMLDSig + SOAP Gov.br)
    router.push('/transmissao-manual')
  }

  const pendentes = lista.filter(t => t.status === 'pendente')

  function toggleSel(id: string) {
    setSelecionados(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id])
  }
  function toggleTodos() {
    const selPendentes = pendentes.map(t => t.id)
    if (selecionados.length === selPendentes.length) setSelecionados([])
    else setSelecionados(selPendentes)
  }

  function fmtData(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
  }

  if (carregando) return <div style={s.loading}>Carregando...</div>

  return (
    <Layout pagina="historico">
      <Head><title>Histórico — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>Histórico de transmissões</div>
          <div style={s.sub}>{lista.length} registro(s) · {pendentes.length} pendente(s)</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {!temCertificado && (
            <button style={{ ...s.btnOutline, color:'#EF9F27', borderColor:'#EF9F27' }}
              onClick={() => router.push('/configuracoes')}>
              ⚠ Configurar certificado
            </button>
          )}
          {modoSelecao ? (
            <button style={s.btnOutline} onClick={() => { setModoSelecao(false); setSelecionados([]) }}>
              Cancelar seleção
            </button>
          ) : (
            <button style={s.btnOutline} onClick={() => setModoSelecao(true)}>
              Selecionar
            </button>
          )}
        </div>
      </div>

      {sucesso && <div style={s.sucessoBox}>{sucesso}</div>}
      {erro    && <div style={s.erroBox}>{erro}</div>}

      {/* Aviso certificado */}
      {!temCertificado && (
        <div style={{ background:'#FAEEDA', border:'1px solid #EF9F27', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#633806', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>⚠ <strong>Certificado digital não configurado.</strong> Configure para transmitir ao Gov.br.</div>
          <button style={{ ...s.btnOutline, color:'#633806', borderColor:'#EF9F27', padding:'5px 12px', fontSize:12 }}
            onClick={() => router.push('/configuracoes')}>Configurar →</button>
        </div>
      )}

      {/* Barra de ações dos pendentes */}
      {pendentes.length > 0 && (
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, padding:'12px 16px', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div style={{ fontSize:13, color:'#374151' }}>
            <strong style={{ color:'#EF9F27' }}>{pendentes.length}</strong> transmissão(ões) pendente(s) aguardando envio ao Gov.br
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {modoSelecao && selecionados.length > 0 ? (
              <>
                <button style={s.btnPrimary}
                  onClick={() => transmitir(selecionados)}>
                  {`Transmitir ${selecionados.length} selecionado(s)`}
                </button>
                <button style={{ ...s.btnOutline, color:'#E24B4A', borderColor:'#F09595' }}
                  onClick={() => { if(confirm(`Excluir ${selecionados.length} transmissão(ões)?`)) excluirSelecionados() }}>
                  Excluir selecionados
                </button>
              </>
            ) : (
              <button style={s.btnPrimary}
                onClick={() => transmitir(pendentes.map(t=>t.id))}>
                {`Transmitir todos (${pendentes.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {['','S-2220','S-2240','S-2210'].map(evt => (
          <button key={evt} onClick={() => { setFiltroEvt(evt); carregar(empresaId, evt, filtroSt) }}
            style={{ ...s.filtroBtn, background: filtroEvt===evt?'#185FA5':'#f3f4f6', color: filtroEvt===evt?'#fff':'#374151' }}>
            {evt || 'Todos'}
          </button>
        ))}
        <div style={{ width:1, background:'#e5e7eb' }}/>
        {['','pendente','enviado','rejeitado'].map(st => (
          <button key={st} onClick={() => { setFiltroSt(st); carregar(empresaId, filtroEvt, st) }}
            style={{ ...s.filtroBtn, background: filtroSt===st?'#374151':'#f3f4f6', color: filtroSt===st?'#fff':'#374151' }}>
            {st ? ST_LBL[st] : 'Todos status'}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
        {modoSelecao && pendentes.length > 0 && (
          <div style={{ padding:'10px 16px', background:'#f9fafb', borderBottom:'0.5px solid #e5e7eb', display:'flex', alignItems:'center', gap:10 }}>
            <input type="checkbox"
              checked={selecionados.length === pendentes.length}
              onChange={toggleTodos}
              style={{ cursor:'pointer', width:16, height:16 }}/>
            <span style={{ fontSize:12, color:'#374151' }}>
              {selecionados.length > 0 ? `${selecionados.length} selecionado(s)` : 'Selecionar todos os pendentes'}
            </span>
          </div>
        )}
        <table style={s.table}>
          <thead>
            <tr style={{ background:'#f9fafb' }}>
              {modoSelecao && <th style={{ ...s.th, width:40 }}></th>}
              {['Evento','Funcionário','Data criação','Enviado em','Recibo','Status','Ações'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={modoSelecao?8:7} style={{ textAlign:'center', padding:'2rem', color:'#9ca3af', fontSize:13 }}>
                Nenhuma transmissão encontrada.
              </td></tr>
            ) : lista.map(tx => {
              const [evBg, evCor] = EVT_COR[tx.evento] || ['#f3f4f6','#374151']
              const [stBg, stCor] = ST_COR[tx.status]  || ['#f3f4f6','#374151']
              const isPendente = tx.status === 'pendente'
              const sel = selecionados.includes(tx.id)
              return (
                <tr key={tx.id} style={{ borderBottom:'0.5px solid #f3f4f6', background: sel?'#EFF6FF':'transparent' }}>
                  {modoSelecao && (
                    <td style={{ ...s.td, width:40 }}>
                      {isPendente && (
                        <input type="checkbox" checked={sel} onChange={() => toggleSel(tx.id)}
                          style={{ cursor:'pointer', width:16, height:16 }}/>
                      )}
                    </td>
                  )}
                  <td style={s.td}>
                    <span style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700, background:evBg, color:evCor }}>
                      {tx.evento}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{tx.funcionarios?.nome || '—'}</div>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>{tx.funcionarios?.matricula_esocial || ''}</div>
                  </td>
                  <td style={{ ...s.td, fontSize:12, color:'#6b7280' }}>{fmtData(tx.criado_em)}</td>
                  <td style={{ ...s.td, fontSize:12, color:'#6b7280' }}>{fmtData(tx.dt_envio)}</td>
                  <td style={{ ...s.td, fontSize:11, fontFamily:'monospace', color:'#6b7280', maxWidth:100 }}>
                    {tx.recibo ? tx.recibo.substring(0,16)+'...' : '—'}
                  </td>
                  <td style={s.td}>
                    <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:stBg, color:stCor }}>
                      {ST_LBL[tx.status] || tx.status}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={{ display:'flex', gap:5 }}>
                      {isPendente && (
                        <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }}
                          onClick={() => transmitir([tx.id])}>
                          Enviar
                        </button>
                      )}
                      <button style={{ ...s.btnAcao, color:'#E24B4A', borderColor:'#F09595' }}
                        onClick={() => setConfirmExcluir(tx)}>
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

      {/* Modal confirmar exclusão */}
      {confirmExcluir && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ fontSize:15, fontWeight:600, color:'#111', marginBottom:8 }}>Confirmar exclusão</div>
            <div style={{ fontSize:13, color:'#374151', marginBottom:16, lineHeight:1.6 }}>
              Excluir a transmissão <strong>{confirmExcluir.evento}</strong> de{' '}
              <strong>{confirmExcluir.funcionarios?.nome || '—'}</strong>?
              {confirmExcluir.status === 'enviado' && (
                <div style={{ marginTop:8, background:'#FCEBEB', padding:'8px 12px', borderRadius:8, color:'#E24B4A', fontSize:12 }}>
                  ⚠ Esta transmissão já foi enviada ao Gov.br. A exclusão é apenas local — não cancela o envio.
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...s.btnOutline, color:'#E24B4A', borderColor:'#F09595' }}
                onClick={() => excluir(confirmExcluir.id)}>Confirmar exclusão</button>
              <button style={s.btnOutline} onClick={() => setConfirmExcluir(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

const s: Record<string, CSSProperties> = {
  loading:    { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' },
  header:     { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' },
  titulo:     { fontSize:20, fontWeight:700, color:'#111' },
  sub:        { fontSize:12, color:'#6b7280', marginTop:2 },
  filtroBtn:  { padding:'5px 12px', fontSize:11, fontWeight:500, borderRadius:99, cursor:'pointer', border:'none' },
  table:      { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:         { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'0.5px solid #e5e7eb', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' },
  td:         { padding:'10px 12px', verticalAlign:'middle', color:'#374151' },
  btnAcao:    { padding:'4px 10px', fontSize:11, background:'transparent', border:'0.5px solid #d1d5db', borderRadius:6, cursor:'pointer', color:'#374151' },
  btnPrimary: { padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnOutline: { padding:'8px 16px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', color:'#374151' },
  sucessoBox: { background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  erroBox:    { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modal:      { background:'#fff', borderRadius:12, padding:'1.5rem', width:420, boxShadow:'0 20px 60px rgba(0,0,0,0.15)' },
}
