import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Dashboard() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [kpis, setKpis] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [ultimasTx, setUltimasTx] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase
      .from('usuarios').select('nome, perfil, empresa_id, empresas(razao_social, cnpj)')
      .eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setUsuario(user)
    await carregarDados(user.empresa_id)
    setCarregando(false)
  }

  async function carregarDados(empresaId) {
    const hoje = new Date().toISOString().split('T')[0]
    const em60 = new Date(Date.now() + 60*86400000).toISOString().split('T')[0]

    const [funcs, txs, asos, alertasData, txRecentes] = await Promise.all([
      supabase.from('funcionarios').select('id', { count:'exact' }).eq('empresa_id', empresaId).eq('ativo', true),
      supabase.from('transmissoes').select('status').eq('empresa_id', empresaId),
      supabase.from('asos').select('prox_exame').eq('empresa_id', empresaId),
      supabase.rpc('get_alertas_vencimento', { p_empresa_id: empresaId }),
      supabase.from('transmissoes')
        .select('id, evento, status, dt_envio, recibo, funcionarios(nome, matricula_esocial)')
        .eq('empresa_id', empresaId).order('criado_em', { ascending: false }).limit(5)
    ])

    const totalF = funcs.count || 0
    const totalTx = txs.data?.length || 0
    const enviados = txs.data?.filter(t => t.status === 'enviado' || t.status === 'lote').length || 0
    const rejeitados = txs.data?.filter(t => t.status === 'rejeitado').length || 0
    const vencidos = asos.data?.filter(a => a.prox_exame && a.prox_exame < hoje).length || 0
    const aVencer = asos.data?.filter(a => a.prox_exame && a.prox_exame >= hoje && a.prox_exame <= em60).length || 0
    const emDia = asos.data?.filter(a => a.prox_exame && a.prox_exame > em60).length || 0
    const conformidade = totalF > 0 ? Math.round((emDia / totalF) * 100) : 100

    setKpis({ totalF, totalTx, taxaSucesso: totalTx > 0 ? Math.round((enviados/totalTx)*100) : 0, rejeitados, vencidos, aVencer, emDia, conformidade })
    setAlertas((alertasData.data || []).slice(0, 5))
    setUltimasTx(txRecentes.data || [])
  }

  if (carregando) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' }}>
      Carregando...
    </div>
  )

  return (
    <Layout pagina="dashboard">
      <Head><title>Dashboard — eSocial SST</title></Head>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'#111' }}>Dashboard SST</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
            {usuario?.empresas?.razao_social} · CNPJ {usuario?.empresas?.cnpj}
          </div>
        </div>
        <div style={{ fontSize:12, color:'#6b7280' }}>
          {new Date().toLocaleDateString('pt-BR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:'1.25rem' }}>
        {[
          { n: kpis?.totalF ?? 0,                  l:'Funcionários',    c:'#185FA5' },
          { n: (kpis?.taxaSucesso ?? 0) + '%',     l:'Taxa de sucesso', c:'#1D9E75' },
          { n: (kpis?.vencidos ?? 0) + (kpis?.aVencer ?? 0), l:'Alertas urgentes', c:'#E24B4A' },
          { n: (kpis?.conformidade ?? 100) + '%',  l:'ASOs em dia',     c:'#EF9F27' },
        ].map((k, i) => (
          <div key={i} style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1rem' }}>
            <div style={{ fontSize:24, fontWeight:700, color:k.c, marginBottom:4 }}>{k.n}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>{k.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:'1rem' }}>

        {/* Alertas */}
        <div style={s.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={s.cardTit}>Alertas prioritários</div>
            <a href="/alertas" style={s.verTodos}>Ver todos →</a>
          </div>
          {alertas.length === 0 ? (
            <div style={s.empty}>Nenhum alerta no momento.</div>
          ) : alertas.map((a, i) => {
            const dias = a.dias_restantes ?? null
            const semAso = dias === null || a.tipo_alerta === 'Sem ASO'
            const vencido = !semAso && dias < 0
            const critico = !semAso && !vencido && dias <= 30
            const cor = semAso ? '#6b7280' : vencido ? '#E24B4A' : critico ? '#EF9F27' : '#1D9E75'
            const bg  = semAso ? '#f9fafb' : vencido ? '#FCEBEB' : critico ? '#FAEEDA' : '#f9fafb'
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background:bg, marginBottom:6 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'#111' }}>{a.nome}</div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>{a.setor || '—'} · {a.tipo_alerta}</div>
                </div>
                <div style={{ fontSize:11, fontWeight:600, color:cor, whiteSpace:'nowrap' }}>
                  {semAso ? 'Sem ASO' : vencido ? `Vencido há ${Math.abs(dias)}d` : dias === 0 ? 'Vence hoje!' : `${dias}d restantes`}
                </div>
              </div>
            )
          })}
        </div>

        {/* Últimas transmissões */}
        <div style={s.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={s.cardTit}>Últimas transmissões</div>
            <a href="/historico" style={s.verTodos}>Ver todas →</a>
          </div>
          {ultimasTx.length === 0 ? (
            <div style={s.empty}>Nenhuma transmissão ainda.</div>
          ) : ultimasTx.map((tx, i) => {
            const evBg  = tx.evento==='S-2210'?'#FCEBEB':tx.evento==='S-2220'?'#E6F1FB':'#FAEEDA'
            const evCor = tx.evento==='S-2210'?'#791F1F':tx.evento==='S-2220'?'#0C447C':'#633806'
            const stCor = tx.status==='enviado'||tx.status==='lote'?'#1D9E75':tx.status==='rejeitado'?'#E24B4A':'#EF9F27'
            const stLbl = tx.status==='enviado'||tx.status==='lote'?'Enviado':tx.status==='rejeitado'?'Rejeitado':'Pendente'
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'0.5px solid #f3f4f6' }}>
                <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600, background:evBg, color:evCor, flexShrink:0 }}>{tx.evento}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'#111' }}>{tx.funcionarios?.nome || '—'}</div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>{tx.dt_envio ? new Date(tx.dt_envio).toLocaleDateString('pt-BR') : '—'}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:600, color:stCor }}>{stLbl}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Ações rápidas */}
      <div style={s.card}>
        <div style={s.cardTit}>Ações rápidas</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginTop:12 }}>
          {[
            { href:'/leitor',        label:'Leitor PDF',    sub:'PDF/XML',     cor:'#185FA5', bg:'#E6F1FB' },
            { href:'/s2220',         label:'Novo ASO',      sub:'S-2220',      cor:'#185FA5', bg:'#E6F1FB' },
            { href:'/s2240',         label:'Novo LTCAT',    sub:'S-2240',      cor:'#854F0B', bg:'#FAEEDA' },
            { href:'/s2210',         label:'Nova CAT',      sub:'S-2210',      cor:'#791F1F', bg:'#FCEBEB' },
            { href:'/funcionarios',  label:'Funcionários',  sub:'Cadastro',    cor:'#085041', bg:'#E1F5EE' },
            { href:'/alertas',       label:'Alertas',       sub:'Vencimentos', cor:'#633806', bg:'#FAEEDA' },
          ].map((a, i) => (
            <a key={i} href={a.href} style={{ padding:'12px 10px', borderRadius:10, textDecoration:'none', textAlign:'center', background:a.bg, transition:'opacity .15s' }}>
              <div style={{ fontSize:13, fontWeight:600, color:a.cor }}>{a.label}</div>
              <div style={{ fontSize:11, color:a.cor, opacity:.8 }}>{a.sub}</div>
            </a>
          ))}
        </div>
      </div>
    </Layout>
  )
}

const s = {
  card:    { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1rem', marginBottom:'1rem' },
  cardTit: { fontSize:13, fontWeight:600, color:'#111' },
  verTodos:{ fontSize:11, color:'#185FA5', textDecoration:'none' },
  empty:   { fontSize:13, color:'#9ca3af', textAlign:'center', padding:'1rem 0' },
}
