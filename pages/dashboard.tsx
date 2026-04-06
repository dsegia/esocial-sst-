import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type KPIs = {
  total_funcionarios: number
  total_transmissoes: number
  tx_enviadas: number
  tx_rejeitadas: number
  tx_pendentes: number
  asos_vencidos: number
  asos_a_vencer_30d: number
  ltcats_vigentes: number
  cats_este_mes: number
}

type Alerta = {
  funcionario_id: string
  nome: string
  matricula: string
  setor: string
  tipo_alerta: string
  data_venc: string
  dias_restantes: number
}

type Transmissao = {
  id: string
  evento: string
  status: string
  dt_envio: string
  recibo: string
  funcionarios: { nome: string; matricula_esocial: string } | null
}

type Usuario = {
  nome: string
  perfil: string
  empresa_id: string
  empresas: { razao_social: string; cnpj: string }
}

export default function Dashboard() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [ultimasTx, setUltimasTx] = useState<Transmissao[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    verificarSessao()
  }, [])

  async function verificarSessao() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }

    const { data: user } = await supabase
      .from('usuarios')
      .select('nome, perfil, empresa_id, empresas(razao_social, cnpj)')
      .eq('id', session.user.id)
      .single()

    if (!user) { router.push('/'); return }
    setUsuario(user as unknown as Usuario)
    await carregarDados((user as unknown as Usuario).empresa_id)
    setCarregando(false)
  }

  async function carregarDados(empresaId: string) {
    // KPIs via função SQL
    const { data: kpiData } = await supabase
      .rpc('get_kpis_dashboard', { p_empresa_id: empresaId })
    if (kpiData) setKpis(kpiData as KPIs)

    // Alertas de vencimento
    const { data: alertaData } = await supabase
      .rpc('get_alertas_vencimento', { p_empresa_id: empresaId })
    if (alertaData) setAlertas((alertaData as Alerta[]).slice(0, 5))

    // Últimas transmissões
    const { data: txData } = await supabase
      .from('transmissoes')
      .select('id, evento, status, dt_envio, recibo, funcionarios(nome, matricula_esocial)')
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false })
      .limit(5)
    if (txData) setUltimasTx(txData as unknown as Transmissao[])
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (carregando) {
    return (
      <div style={{ ...s.page, justifyContent: 'center', alignItems: 'center' }}>
        <div style={s.loadingBox}>
          <div style={s.logoBox}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="14,3 14,8 19,8"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, color: '#6b7280', marginTop: 12 }}>Carregando...</div>
        </div>
      </div>
    )
  }

  const conformidade = kpis && kpis.total_funcionarios > 0
    ? Math.round(((kpis.total_funcionarios - kpis.asos_vencidos) / kpis.total_funcionarios) * 100)
    : 100

  const taxaSucesso = kpis && kpis.total_transmissoes > 0
    ? Math.round((kpis.tx_enviadas / kpis.total_transmissoes) * 100)
    : 0

  return (
    <>
      <Head><title>Dashboard — eSocial SST</title></Head>
      <div style={s.page}>

        {/* ── SIDEBAR ── */}
        <div style={s.sidebar}>
          <div style={s.sideLogoWrap}>
            <div style={s.logoBox}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="14,3 14,8 19,8"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>eSocial SST</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>Transmissor</div>
            </div>
          </div>

          <nav style={s.nav}>
            {[
              { href: '/dashboard', label: 'Dashboard', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
              { href: '/funcionarios', label: 'Funcionários', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
              { href: '/s2220', label: 'S-2220 — ASO', icon: 'M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2zM14 3v5h5' },
              { href: '/s2240', label: 'S-2240 — LTCAT', icon: 'M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2zM14 3v5h5' },
              { href: '/s2210', label: 'S-2210 — CAT', icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01' },
              { href: '/historico', label: 'Histórico', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
              { href: '/alertas', label: 'Alertas', icon: 'M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zM12 6v6l4 2' },
            ].map(item => (
              <a key={item.href} href={item.href} style={{
                ...s.navItem,
                ...(item.href === '/dashboard' ? s.navItemActive : {})
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke={item.href === '/dashboard' ? '#185FA5' : '#6b7280'} strokeWidth="2">
                  <path d={item.icon}/>
                </svg>
                {item.label}
              </a>
            ))}
          </nav>

          <div style={s.sideFooter}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 2 }}>
              {usuario?.nome}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
              {usuario?.empresas?.razao_social}
            </div>
            <button onClick={sair} style={s.btnSair}>Sair</button>
          </div>
        </div>

        {/* ── CONTEÚDO PRINCIPAL ── */}
        <div style={s.main}>

          {/* Header */}
          <div style={s.header}>
            <div>
              <div style={s.headerTitle}>Dashboard SST</div>
              <div style={s.headerSub}>
                {usuario?.empresas?.razao_social} · CNPJ {usuario?.empresas?.cnpj}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          {/* KPIs */}
          <div style={s.kpiGrid}>
            {[
              { num: kpis?.total_funcionarios ?? 0, lbl: 'Funcionários', cor: '#185FA5' },
              { num: taxaSucesso + '%', lbl: 'Taxa de sucesso', cor: '#1D9E75' },
              { num: (kpis?.asos_vencidos ?? 0) + (kpis?.asos_a_vencer_30d ?? 0), lbl: 'Alertas urgentes', cor: '#E24B4A' },
              { num: conformidade + '%', lbl: 'ASOs em dia', cor: '#EF9F27' },
            ].map((k, i) => (
              <div key={i} style={s.kpiCard}>
                <div style={{ fontSize: 24, fontWeight: 700, color: k.cor, marginBottom: 4 }}>{k.num}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{k.lbl}</div>
              </div>
            ))}
          </div>

          <div style={s.grid2}>

            {/* Alertas de vencimento */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardTitle}>Alertas prioritários</div>
                <a href="/alertas" style={s.verTodos}>Ver todos →</a>
              </div>
              {alertas.length === 0 ? (
                <div style={s.empty}>Nenhum alerta no momento.</div>
              ) : alertas.map((a, i) => {
                const vencido = a.dias_restantes < 0
                const critico = a.dias_restantes >= 0 && a.dias_restantes <= 30
                const cor = vencido ? '#E24B4A' : critico ? '#EF9F27' : '#6b7280'
                const bg = vencido ? '#FCEBEB' : critico ? '#FAEEDA' : '#f9fafb'
                return (
                  <div key={i} style={{ ...s.alertaRow, background: bg }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{a.nome}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{a.setor} · {a.tipo_alerta}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: cor, whiteSpace: 'nowrap' }}>
                      {a.dias_restantes < 0
                        ? `Vencido há ${Math.abs(a.dias_restantes)}d`
                        : a.dias_restantes === 0
                          ? 'Vence hoje!'
                          : `${a.dias_restantes}d restantes`}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Últimas transmissões */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardTitle}>Últimas transmissões</div>
                <a href="/historico" style={s.verTodos}>Ver todas →</a>
              </div>
              {ultimasTx.length === 0 ? (
                <div style={s.empty}>Nenhuma transmissão ainda.</div>
              ) : ultimasTx.map((tx, i) => {
                const evCor = tx.evento === 'S-2210' ? '#FCEBEB' : tx.evento === 'S-2220' ? '#E6F1FB' : '#FAEEDA'
                const evTxt = tx.evento === 'S-2210' ? '#791F1F' : tx.evento === 'S-2220' ? '#0C447C' : '#633806'
                const stCor = tx.status === 'enviado' || tx.status === 'lote' ? '#1D9E75' : tx.status === 'rejeitado' ? '#E24B4A' : '#EF9F27'
                const stLbl = tx.status === 'enviado' || tx.status === 'lote' ? 'Enviado' : tx.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'
                return (
                  <div key={i} style={s.txRow}>
                    <span style={{ ...s.evBadge, background: evCor, color: evTxt }}>{tx.evento}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>
                        {tx.funcionarios?.nome || '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        {tx.dt_envio ? new Date(tx.dt_envio).toLocaleDateString('pt-BR') : '—'}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: stCor }}>{stLbl}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Ações rápidas */}
          <div style={s.card}>
            <div style={s.cardTitle}>Ações rápidas</div>
            <div style={s.acoesGrid}>
              {[
                { href: '/s2220', label: 'Novo ASO', sub: 'S-2220', cor: '#185FA5', bg: '#E6F1FB' },
                { href: '/s2240', label: 'Novo LTCAT', sub: 'S-2240', cor: '#854F0B', bg: '#FAEEDA' },
                { href: '/s2210', label: 'Nova CAT', sub: 'S-2210', cor: '#791F1F', bg: '#FCEBEB' },
                { href: '/funcionarios', label: 'Funcionários', sub: 'Cadastro', cor: '#085041', bg: '#E1F5EE' },
                { href: '/historico', label: 'Histórico', sub: 'Transmissões', cor: '#3C3489', bg: '#EEEDFE' },
                { href: '/alertas', label: 'Alertas', sub: 'Vencimentos', cor: '#633806', bg: '#FAEEDA' },
              ].map((a, i) => (
                <a key={i} href={a.href} style={{ ...s.acaoCard, background: a.bg }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: a.cor }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: a.cor, opacity: 0.8 }}>{a.sub}</div>
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ─── ESTILOS ──────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex', minHeight: '100vh',
    background: '#f4f6f9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  sidebar: {
    width: 220, flexShrink: 0,
    background: '#fff', borderRight: '0.5px solid #e5e7eb',
    display: 'flex', flexDirection: 'column',
    padding: '1.25rem 0',
  },
  sideLogoWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0 1.25rem 1.25rem',
    borderBottom: '0.5px solid #e5e7eb', marginBottom: '1rem',
  },
  logoBox: {
    width: 36, height: 36, background: '#185FA5',
    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  loadingBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  nav: { flex: 1, padding: '0 .75rem' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 12px', borderRadius: 8, marginBottom: 2,
    fontSize: 13, color: '#374151', textDecoration: 'none',
    transition: 'background 0.15s',
  },
  navItemActive: {
    background: '#E6F1FB', color: '#185FA5', fontWeight: 500,
  },
  sideFooter: {
    padding: '1rem 1.25rem 0',
    borderTop: '0.5px solid #e5e7eb',
    marginTop: '1rem',
  },
  btnSair: {
    width: '100%', padding: '7px',
    background: 'transparent', border: '0.5px solid #d1d5db',
    borderRadius: 8, fontSize: 12, color: '#6b7280',
    cursor: 'pointer',
  },
  main: { flex: 1, padding: '1.5rem', overflowY: 'auto' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '1.25rem',
  },
  headerTitle: { fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 3 },
  headerSub: { fontSize: 12, color: '#6b7280' },
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12, marginBottom: '1.25rem',
  },
  kpiCard: {
    background: '#fff', border: '0.5px solid #e5e7eb',
    borderRadius: 12, padding: '1rem',
  },
  grid2: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 12, marginBottom: '1rem',
  },
  card: {
    background: '#fff', border: '0.5px solid #e5e7eb',
    borderRadius: 12, padding: '1rem', marginBottom: '1rem',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 13, fontWeight: 600, color: '#111' },
  verTodos: { fontSize: 11, color: '#185FA5', textDecoration: 'none' },
  empty: { fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '1rem 0' },
  alertaRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: 8, marginBottom: 6,
  },
  txRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 0', borderBottom: '0.5px solid #f3f4f6',
  },
  evBadge: {
    padding: '2px 8px', borderRadius: 99,
    fontSize: 10, fontWeight: 600, flexShrink: 0,
  },
  acoesGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 10, marginTop: 12,
  },
  acaoCard: {
    padding: '12px 10px', borderRadius: 10,
    textDecoration: 'none', textAlign: 'center',
    transition: 'opacity 0.15s',
  },
}
