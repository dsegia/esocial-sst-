import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { getEmpresaId } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Dashboard() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [empresa, setEmpresa] = useState(null)
  const [kpis, setKpis] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [ultimasTx, setUltimasTx] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }

    const { data: user } = await supabase
      .from('usuarios')
      .select('nome, perfil, empresa_id, empresas(razao_social, cnpj, cert_digital_validade)')
      .eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }

    const empId = getEmpresaId() || user.empresa_id
    setUsuario(user)
    setEmpresa(user.empresas)
    await carregarDados(empId)
    setCarregando(false)
  }

  async function carregarDados(empresaId) {
    const hoje = new Date()
    const em30 = new Date(hoje); em30.setDate(em30.getDate() + 30)
    const em60 = new Date(hoje); em60.setDate(em60.getDate() + 60)
    const em90 = new Date(hoje); em90.setDate(em90.getDate() + 90)

    const [funcsRes, asosRes, txRes, ltcatRes, catsRes] = await Promise.all([
      supabase.from('funcionarios').select('id, nome, cpf, data_adm, data_nasc, matricula_esocial, funcao, setor, ativo').eq('empresa_id', empresaId),
      supabase.from('asos').select('id, funcionario_id, tipo_aso, data_exame, prox_exame, conclusao').eq('empresa_id', empresaId).order('data_exame', { ascending: false }),
      supabase.from('transmissoes').select('id, evento, status, criado_em, recibo, dt_envio, funcionarios(nome)').eq('empresa_id', empresaId).order('criado_em', { ascending: false }),
      supabase.from('ltcats').select('id, data_emissao, prox_revisao, ativo, ghes').eq('empresa_id', empresaId).eq('ativo', true).limit(1).single(),
      supabase.from('cats').select('id, criado_em').eq('empresa_id', empresaId),
    ])

    const funcs    = (funcsRes.data || []).filter(f => f.ativo)
    const asos     = asosRes.data || []
    const txs      = txRes.data || []
    const ltcat    = ltcatRes.data || null
    const cats     = catsRes.data || []

    // Último ASO por funcionário
    const ultimoAso = (funcId) => asos.filter(a => a.funcionario_id === funcId)
      .sort((a,b) => new Date(b.data_exame) - new Date(a.data_exame))[0] || null

    // Última TX por funcionário e evento
    const ultimaTx = (funcId, evento) => txs.filter(t => t.funcionario_id === funcId && t.evento === evento)[0] || null

    // Dados incompletos
    const incompletos = funcs.filter(f =>
      !f.data_adm || !f.data_nasc || !f.matricula_esocial || f.matricula_esocial.startsWith('PEND-')
    )

    // ASOs vencidos e a vencer
    const asoVencidos = []
    const asoVence30  = []
    const asoVence60  = []
    const semAso      = []
    const asoEmDia    = []

    funcs.forEach(f => {
      const aso = ultimoAso(f.id)
      if (!aso) { semAso.push(f); return }
      if (!aso.prox_exame) { asoVence60.push({ func: f, aso }); return }
      const prox = new Date(aso.prox_exame)
      if (prox < hoje)   { asoVencidos.push({ func: f, aso }); return }
      if (prox <= em30)  { asoVence30.push({ func: f, aso }); return }
      if (prox <= em60)  { asoVence60.push({ func: f, aso }); return }
      asoEmDia.push({ func: f, aso })
    })

    // Transmissões
    const txPendentes  = txs.filter(t => t.status === 'pendente')
    const txRejeitadas = txs.filter(t => t.status === 'rejeitado')
    const txEnviadas   = txs.filter(t => t.status === 'enviado')
    const txHoje       = txs.filter(t => {
      const d = new Date(t.criado_em); return d.toDateString() === hoje.toDateString()
    })

    // LTCAT vencido?
    const ltcatVencido = ltcat?.prox_revisao && new Date(ltcat.prox_revisao) < hoje
    const ltcatVence30 = ltcat?.prox_revisao && new Date(ltcat.prox_revisao) <= em30 && new Date(ltcat.prox_revisao) >= hoje

    // Conformidade geral
    const totalFunc = funcs.length
    const conformidade = totalFunc > 0
      ? Math.round((asoEmDia.length / totalFunc) * 100)
      : 100

    // Montar alertas ordenados por criticidade
    const alertasLista = []

    if (txRejeitadas.length > 0) alertasLista.push({
      tipo: 'erro', icon: '❌',
      titulo: `${txRejeitadas.length} transmissão(ões) rejeitada(s)`,
      desc: 'Verifique os erros e retransmita',
      acao: 'Ver transmissões', rota: '/relatorios',
    })
    if (asoVencidos.length > 0) alertasLista.push({
      tipo: 'erro', icon: '🚨',
      titulo: `${asoVencidos.length} ASO(s) vencido(s)`,
      desc: asoVencidos.slice(0,2).map(x => x.func.nome.split(' ')[0]).join(', ') + (asoVencidos.length > 2 ? ` +${asoVencidos.length-2}` : ''),
      acao: 'Ver S-2220', rota: '/s2220',
    })
    if (ltcatVencido) alertasLista.push({
      tipo: 'erro', icon: '📋',
      titulo: 'LTCAT com revisão vencida',
      desc: `Revisão deveria ter sido feita em ${new Date(ltcat.prox_revisao+'T12:00:00').toLocaleDateString('pt-BR')}`,
      acao: 'Ver LTCAT', rota: '/ltcat',
    })
    if (incompletos.length > 0) alertasLista.push({
      tipo: 'aviso', icon: '⚠️',
      titulo: `${incompletos.length} funcionário(s) com dados incompletos`,
      desc: 'Faltam: data admissão, nascimento ou matrícula eSocial',
      acao: 'Completar dados', rota: '/funcionarios',
    })
    if (asoVence30.length > 0) alertasLista.push({
      tipo: 'aviso', icon: '⏰',
      titulo: `${asoVence30.length} ASO(s) vencendo em até 30 dias`,
      desc: asoVence30.slice(0,2).map(x => x.func.nome.split(' ')[0]).join(', ') + (asoVence30.length > 2 ? ` +${asoVence30.length-2}` : ''),
      acao: 'Agendar exames', rota: '/s2220',
    })
    if (txPendentes.length > 0) alertasLista.push({
      tipo: 'info', icon: '📡',
      titulo: `${txPendentes.length} evento(s) aguardando transmissão`,
      desc: `S-2220: ${txPendentes.filter(t=>t.evento==='S-2220').length} · S-2240: ${txPendentes.filter(t=>t.evento==='S-2240').length} · S-2210: ${txPendentes.filter(t=>t.evento==='S-2210').length}`,
      acao: 'Transmitir', rota: '/transmissao-manual',
    })
    if (!ltcat) alertasLista.push({
      tipo: 'info', icon: '📄',
      titulo: 'Nenhum LTCAT cadastrado',
      desc: 'Necessário para transmitir S-2240',
      acao: 'Cadastrar LTCAT', rota: '/ltcat',
    })
    if (semAso.length > 0) alertasLista.push({
      tipo: 'info', icon: '🩺',
      titulo: `${semAso.length} funcionário(s) sem ASO`,
      desc: semAso.slice(0,2).map(x => x.nome.split(' ')[0]).join(', ') + (semAso.length > 2 ? ` +${semAso.length-2}` : ''),
      acao: 'Importar ASO', rota: '/leitor',
    })

    setAlertas(alertasLista)
    setUltimasTx(txs.slice(0, 8))
    setKpis({
      totalFunc, conformidade, semAso: semAso.length,
      asoVencidos: asoVencidos.length, asoVence30: asoVence30.length,
      asoEmDia: asoEmDia.length, incompletos: incompletos.length,
      txPendentes: txPendentes.length, txRejeitadas: txRejeitadas.length,
      txEnviadas: txEnviadas.length, txHoje: txHoje.length,
      ltcat, ltcatVencido, ltcatVence30,
      ghes: ltcat?.ghes?.length || 0,
      cats: cats.length,
    })
  }

  function diasParaVencer(d) {
    if (!d) return null
    return Math.round((new Date(d) - new Date()) / 86400000)
  }

  if (carregando) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid #185FA5', borderTopColor:'transparent', borderRadius:'50%', margin:'0 auto 12px', animation:'spin 1s linear infinite' }}/>
        <div style={{ fontSize:13, color:'#6b7280' }}>Carregando dashboard...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const nomeUsuario = (usuario?.nome || 'usuário').split(' ')[0]

  const EVT_COR = { 'S-2210':['#FCEBEB','#791F1F'], 'S-2220':['#E6F1FB','#0C447C'], 'S-2240':['#FAEEDA','#633806'] }
  const ST_COR  = { enviado:['#EAF3DE','#27500A'], pendente:['#FAEEDA','#633806'], rejeitado:['#FCEBEB','#791F1F'] }

  return (
    <Layout pagina="dashboard">
      <Head><title>Dashboard — eSocial SST</title></Head>

      {/* Saudação */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'#111' }}>
            {saudacao}, {nomeUsuario}! 👋
          </div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>
            {empresa?.razao_social} · {new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={s.btnOutline} onClick={() => router.push('/importar')}>↑ Importar documento</button>
          <button style={s.btnPrimary} onClick={() => router.push('/transmissao-manual')}>
            📡 Transmitir ({kpis?.txPendentes || 0})
          </button>
        </div>
      </div>

      {/* KPIs principais */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:14 }}>
        {[
          {
            label:'Funcionários',
            valor: kpis?.totalFunc || 0,
            sub: `${kpis?.incompletos || 0} com dados incompletos`,
            cor: kpis?.incompletos > 0 ? '#EF9F27' : '#185FA5',
            bg: kpis?.incompletos > 0 ? '#FAEEDA' : '#f9fafb',
            rota: '/funcionarios',
          },
          {
            label:'Conformidade ASO',
            valor: (kpis?.conformidade || 0) + '%',
            sub: `${kpis?.asoEmDia || 0} de ${kpis?.totalFunc || 0} em dia`,
            cor: (kpis?.conformidade || 0) >= 80 ? '#1D9E75' : (kpis?.conformidade || 0) >= 60 ? '#EF9F27' : '#E24B4A',
            bg: (kpis?.conformidade || 0) >= 80 ? '#EAF3DE' : (kpis?.conformidade || 0) >= 60 ? '#FAEEDA' : '#FCEBEB',
            rota: '/s2220',
          },
          {
            label:'ASOs vencidos',
            valor: kpis?.asoVencidos || 0,
            sub: `${kpis?.asoVence30 || 0} vencem em 30 dias`,
            cor: (kpis?.asoVencidos || 0) > 0 ? '#E24B4A' : '#1D9E75',
            bg: (kpis?.asoVencidos || 0) > 0 ? '#FCEBEB' : '#EAF3DE',
            rota: '/s2220',
          },
          {
            label:'Pendentes envio',
            valor: kpis?.txPendentes || 0,
            sub: `${kpis?.txRejeitadas || 0} rejeitada(s)`,
            cor: (kpis?.txRejeitadas || 0) > 0 ? '#E24B4A' : (kpis?.txPendentes || 0) > 0 ? '#EF9F27' : '#1D9E75',
            bg: (kpis?.txRejeitadas || 0) > 0 ? '#FCEBEB' : (kpis?.txPendentes || 0) > 0 ? '#FAEEDA' : '#EAF3DE',
            rota: '/relatorios',
          },
          {
            label:'Enviados total',
            valor: kpis?.txEnviadas || 0,
            sub: `${kpis?.txHoje || 0} hoje`,
            cor: '#185FA5',
            bg: '#f9fafb',
            rota: '/relatorios',
          },
        ].map((k,i) => (
          <div key={i} onClick={() => router.push(k.rota)}
            style={{ background: k.bg, border:`0.5px solid ${k.cor}33`, borderRadius:12, padding:'1rem', cursor:'pointer', transition:'transform .1s' }}
            onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform='none'}>
            <div style={{ fontSize:26, fontWeight:800, color:k.cor }}>{k.valor}</div>
            <div style={{ fontSize:12, fontWeight:600, color:'#111', marginTop:2 }}>{k.label}</div>
            <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>

        {/* Alertas */}
        <div style={s.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={s.cardTit}>🔔 Alertas e pendências</div>
            <span style={{ fontSize:11, color:'#9ca3af' }}>{alertas.length} item(s)</span>
          </div>
          {alertas.length === 0 ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af', fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
              Tudo em dia! Nenhuma pendência.
            </div>
          ) : alertas.map((al, i) => {
            const BG  = { erro:'#FCEBEB', aviso:'#FAEEDA', info:'#EFF6FF' }
            const COR = { erro:'#791F1F', aviso:'#633806', info:'#1e40af' }
            const BR  = { erro:'#F09595', aviso:'#FAC775', info:'#93c5fd' }
            return (
              <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'9px 10px', borderRadius:8, background:BG[al.tipo], border:`0.5px solid ${BR[al.tipo]}`, marginBottom:6 }}>
                <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>{al.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:COR[al.tipo] }}>{al.titulo}</div>
                  {al.desc && <div style={{ fontSize:11, color:COR[al.tipo], opacity:0.8, marginTop:1 }}>{al.desc}</div>}
                </div>
                <button onClick={() => router.push(al.rota)} style={{ flexShrink:0, padding:'2px 8px', fontSize:10, fontWeight:500, background:'rgba(0,0,0,0.08)', border:'none', borderRadius:6, cursor:'pointer', color:COR[al.tipo], whiteSpace:'nowrap' }}>
                  {al.acao} →
                </button>
              </div>
            )
          })}
        </div>

        {/* Ações rápidas + Info LTCAT */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

          {/* LTCAT status */}
          <div style={{ ...s.card, padding:'14px' }}>
            <div style={s.cardTit}>📋 LTCAT</div>
            {kpis?.ltcat ? (
              <div style={{ marginTop:8 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                  {[
                    { l:'Emissão', v: new Date(kpis.ltcat.data_emissao+'T12:00:00').toLocaleDateString('pt-BR') },
                    { l:'GHEs', v: kpis.ghes },
                    { l:'Próx. revisão', v: kpis.ltcat.prox_revisao ? new Date(kpis.ltcat.prox_revisao+'T12:00:00').toLocaleDateString('pt-BR') : '—' },
                  ].map((it,i) => (
                    <div key={i} style={{ background:'#f9fafb', borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase' }}>{it.l}</div>
                      <div style={{ fontSize:14, fontWeight:700, color: i===2&&kpis.ltcatVencido?'#E24B4A':i===2&&kpis.ltcatVence30?'#EF9F27':'#111', marginTop:2 }}>{it.v}</div>
                    </div>
                  ))}
                </div>
                {kpis.ltcatVencido && <div style={{ marginTop:8, fontSize:11, color:'#E24B4A', fontWeight:500 }}>⚠ Revisão vencida — atualize o LTCAT</div>}
              </div>
            ) : (
              <div style={{ marginTop:8, fontSize:12, color:'#E24B4A' }}>Nenhum LTCAT ativo.</div>
            )}
            <button onClick={() => router.push('/ltcat')} style={{ ...s.btnOutline, width:'100%', marginTop:10, fontSize:12 }}>
              Gerenciar LTCAT →
            </button>
          </div>

          {/* Ações rápidas */}
          <div style={s.card}>
            <div style={{ ...s.cardTit, marginBottom:10 }}>⚡ Ações rápidas</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { l:'↑ Importar documento',   rota:'/importar',                    cor:'#185FA5', bg:'#E6F1FB' },
                { l:'📡 Transmitir eventos',  rota:'/transmissao-manual',  cor:'#1D9E75', bg:'#EAF3DE' },
                { l:'👥 Funcionários',         rota:'/funcionarios',         cor:'#374151', bg:'#f3f4f6' },
                { l:'🩺 S-2220 Saúde',         rota:'/s2220',                cor:'#0C447C', bg:'#E6F1FB' },
                { l:'🏭 S-2240 Ambiente',      rota:'/s2240',                cor:'#633806', bg:'#FAEEDA' },
                { l:'📊 Relatórios',           rota:'/relatorios',           cor:'#374151', bg:'#f3f4f6' },
              ].map((a,i) => (
                <button key={i} onClick={() => router.push(a.rota)}
                  style={{ padding:'10px', background:a.bg, border:'none', borderRadius:9, fontSize:12, fontWeight:600, color:a.cor, cursor:'pointer', textAlign:'left', transition:'opacity .15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity='0.8'}
                  onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                  {a.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Últimas transmissões */}
      <div style={s.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={s.cardTit}>📡 Últimas transmissões</div>
          <button onClick={() => router.push('/relatorios')} style={{ fontSize:12, color:'#185FA5', background:'none', border:'none', cursor:'pointer' }}>
            Ver todas →
          </button>
        </div>
        {ultimasTx.length === 0 ? (
          <div style={{ fontSize:13, color:'#9ca3af', textAlign:'center', padding:'1.5rem' }}>Nenhuma transmissão registrada ainda.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['Evento','Funcionário','Data','Status','Recibo'].map(h => (
                  <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:10, fontWeight:600, color:'#9ca3af', borderBottom:'0.5px solid #f3f4f6', textTransform:'uppercase', letterSpacing:'.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ultimasTx.map(tx => {
                const [evBg,evCor] = EVT_COR[tx.evento]||['#f3f4f6','#374151']
                const [stBg,stCor] = ST_COR[tx.status]||['#f3f4f6','#374151']
                return (
                  <tr key={tx.id} style={{ borderBottom:'0.5px solid #f9fafb' }}>
                    <td style={{ padding:'8px 10px' }}>
                      <span style={{ padding:'2px 7px', borderRadius:99, fontSize:10, fontWeight:700, background:evBg, color:evCor }}>{tx.evento}</span>
                    </td>
                    <td style={{ padding:'8px 10px', color:'#374151' }}>
                      <span style={{ fontWeight:500 }}>{tx.funcionarios?.nome?.split(' ').slice(0,2).join(' ')||'—'}</span>
                    </td>
                    <td style={{ padding:'8px 10px', color:'#6b7280', whiteSpace:'nowrap' }}>
                      {new Date(tx.criado_em).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding:'8px 10px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600, background:stBg, color:stCor }}>
                        {tx.status}
                      </span>
                    </td>
                    <td style={{ padding:'8px 10px', color:'#9ca3af', fontFamily:'monospace', fontSize:10 }}>
                      {tx.recibo ? tx.recibo.substring(0,14)+'...' : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}

const s = {
  card:       { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem' },
  cardTit:    { fontSize:13, fontWeight:600, color:'#111' },
  btnPrimary: { padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnOutline: { padding:'8px 14px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', color:'#374151' },
}
