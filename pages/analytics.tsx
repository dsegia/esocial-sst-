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

export default function Analytics() {
  const router = useRouter()
  const [carregando, setCarregando] = useState(true)
  const [dados, setDados] = useState<any>(null)
  const [empresa, setEmpresa] = useState<any>(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: user } = await supabase
      .from('usuarios')
      .select('empresa_id, empresas(razao_social, cnpj)')
      .eq('id', session.user.id).single()
    if (!user) { router.push('/login'); return }
    const empId = getEmpresaId() || user.empresa_id
    setEmpresa(user.empresas)
    await carregar(empId)
    setCarregando(false)
  }

  async function carregar(empresaId: string) {
    const hoje = new Date()
    const h6 = new Date(hoje); h6.setMonth(h6.getMonth() - 6)
    const h30 = new Date(hoje); h30.setDate(h30.getDate() - 30)

    const [txRes, asosRes, funcsRes] = await Promise.all([
      supabase.from('transmissoes')
        .select('id, evento, status, criado_em')
        .eq('empresa_id', empresaId)
        .gte('criado_em', h6.toISOString())
        .order('criado_em', { ascending: false }),
      supabase.from('asos')
        .select('id, tipo_aso, data_exame, prox_exame, conclusao')
        .eq('empresa_id', empresaId)
        .gte('data_exame', h6.toISOString().split('T')[0]),
      supabase.from('funcionarios')
        .select('id, ativo')
        .eq('empresa_id', empresaId),
    ])

    const txs   = txRes.data || []
    const asos  = asosRes.data || []
    const funcs = (funcsRes.data || []).filter((f: any) => f.ativo)

    // Agrupa transmissões por mês (últimos 6 meses)
    const porMes: Record<string, { label: string; total: number; enviado: number; rejeitado: number; pendente: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje)
      d.setMonth(d.getMonth() - i)
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      porMes[chave] = { label, total: 0, enviado: 0, rejeitado: 0, pendente: 0 }
    }
    txs.forEach((t: any) => {
      const d = new Date(t.criado_em)
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (porMes[chave]) {
        porMes[chave].total++
        if (t.status === 'enviado') porMes[chave].enviado++
        else if (t.status === 'rejeitado') porMes[chave].rejeitado++
        else porMes[chave].pendente++
      }
    })
    const meses = Object.values(porMes)

    // Por evento
    const eventos = ['S-2210', 'S-2220', 'S-2221', 'S-2240']
    const porEvento: Record<string, number> = {}
    eventos.forEach(e => { porEvento[e] = txs.filter((t: any) => t.evento === e).length })

    // Taxa de sucesso
    const enviados   = txs.filter((t: any) => t.status === 'enviado').length
    const rejeitados = txs.filter((t: any) => t.status === 'rejeitado').length
    const pendentes  = txs.filter((t: any) => t.status === 'pendente').length
    const finalizados = enviados + rejeitados
    const taxaSucesso = finalizados > 0 ? Math.round((enviados / finalizados) * 100) : 100

    // Média por dia (30 dias)
    const txUlt30 = txs.filter((t: any) => new Date(t.criado_em) >= h30)
    const mediaDia = (txUlt30.length / 30).toFixed(1)

    // Tipos de ASO
    const asoTipos: Record<string, number> = {}
    asos.forEach((a: any) => { asoTipos[a.tipo_aso] = (asoTipos[a.tipo_aso] || 0) + 1 })

    // ASOs vencidos vs em dia
    const asoVencidos = asos.filter((a: any) => a.prox_exame && new Date(a.prox_exame) < hoje).length
    const asoEmDia    = asos.filter((a: any) => a.prox_exame && new Date(a.prox_exame) >= hoje).length

    setDados({
      meses, porEvento, taxaSucesso, mediaDia,
      totalTx: txs.length, enviados, rejeitados, pendentes,
      totalFuncs: funcs.length, totalAsos: asos.length,
      asoTipos, asoVencidos, asoEmDia,
    })
  }

  if (carregando) return <Loading />

  const d = dados
  const maxBar = Math.max(...d.meses.map((m: any) => m.total), 1)
  const totalEventos = d.totalTx || 1

  const EVT_COR: Record<string, [string, string]> = {
    'S-2210': ['#FCEBEB', '#791F1F'],
    'S-2220': ['#E6F1FB', '#0C447C'],
    'S-2221': ['#EAF3DE', '#1D9E75'],
    'S-2240': ['#FAEEDA', '#633806'],
  }

  return (
    <Layout pagina="analytics">
      <Head><title>Analytics — eSocial SST</title></Head>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>📊 Analytics</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
            {empresa?.razao_social} · métricas dos últimos 6 meses
          </div>
        </div>
        <button style={s.btnOutline} onClick={() => router.push('/relatorio-conformidade')}>
          📋 Ver conformidade →
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          {
            label: 'Transmissões',
            valor: d.totalTx,
            sub: 'últimos 6 meses',
            cor: '#185FA5',
            bg: '#f9fafb',
          },
          {
            label: 'Taxa de sucesso',
            valor: `${d.taxaSucesso}%`,
            sub: `${d.rejeitados} rejeitada(s)`,
            cor: d.taxaSucesso >= 95 ? '#1D9E75' : d.taxaSucesso >= 80 ? '#EF9F27' : '#E24B4A',
            bg: d.taxaSucesso >= 95 ? '#EAF3DE' : d.taxaSucesso >= 80 ? '#FAEEDA' : '#FCEBEB',
          },
          {
            label: 'Média/dia',
            valor: d.mediaDia,
            sub: 'últimos 30 dias',
            cor: '#185FA5',
            bg: '#f9fafb',
          },
          {
            label: 'Funcionários ativos',
            valor: d.totalFuncs,
            sub: `${d.totalAsos} ASOs registrados`,
            cor: '#374151',
            bg: '#f9fafb',
          },
        ].map((k, i) => (
          <div key={i} style={{ background: k.bg, border: `0.5px solid ${k.cor}33`, borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.cor }}>{k.valor}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111', marginTop: 2 }}>{k.label}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Gráfico de barras mensal */}
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 20 }}>
            📈 Volume de transmissões por mês
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120, padding: '0 4px' }}>
            {d.meses.map((m: any, i: number) => {
              const hEnv = maxBar > 0 ? Math.round((m.enviado / maxBar) * 100) : 0
              const hRej = maxBar > 0 ? Math.round((m.rejeitado / maxBar) * 100) : 0
              const hPend = maxBar > 0 ? Math.round((m.pendente / maxBar) * 100) : 0
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  {m.total > 0 && (
                    <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>{m.total}</div>
                  )}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 100, gap: 1 }}>
                    {hRej > 0 && (
                      <div style={{ width: '100%', height: hRej, background: '#F09595', borderRadius: '3px 3px 0 0', minHeight: 3 }} />
                    )}
                    {hPend > 0 && (
                      <div style={{ width: '100%', height: hPend, background: '#FAC775', minHeight: 3 }} />
                    )}
                    <div style={{
                      width: '100%',
                      height: Math.max(hEnv, m.total === 0 ? 3 : 0),
                      background: m.total === 0 ? '#f3f4f6' : '#185FA5',
                      borderRadius: hRej === 0 && hPend === 0 ? '3px 3px 0 0' : '0',
                      minHeight: 3,
                    }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', lineHeight: 1.2 }}>{m.label}</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 8, borderTop: '0.5px solid #f3f4f6' }}>
            {[
              { cor: '#185FA5', label: 'Enviados' },
              { cor: '#F09595', label: 'Rejeitados' },
              { cor: '#FAC775', label: 'Pendentes' },
            ].map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.cor }} />
                <span style={{ fontSize: 10, color: '#6b7280' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Por evento */}
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 16 }}>🔖 Por tipo de evento</div>
          {Object.entries(d.porEvento).map(([evt, qtd]: any, i) => {
            const pct = Math.round((qtd / totalEventos) * 100)
            const [bg, cor] = EVT_COR[evt] || ['#f3f4f6', '#374151']
            return (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: bg, color: cor }}>{evt}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>
                    {qtd} <span style={{ fontSize: 10, color: '#9ca3af' }}>({pct}%)</span>
                  </span>
                </div>
                <div style={{ height: 4, background: '#f3f4f6', borderRadius: 99 }}>
                  <div style={{ height: '100%', background: cor, borderRadius: 99, width: `${pct}%`, transition: 'width .5s' }} />
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '0.5px solid #f3f4f6' }}>
            {[
              { icon: '✅', label: 'Enviados', val: d.enviados, cor: '#1D9E75' },
              { icon: '❌', label: 'Rejeitados', val: d.rejeitados, cor: '#E24B4A' },
              { icon: '⏳', label: 'Pendentes', val: d.pendentes, cor: '#EF9F27' },
            ].map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, fontSize: 11, color: '#6b7280' }}>
                <span>{it.icon} {it.label}</span>
                <strong style={{ color: it.cor }}>{it.val}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ASO */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Status ASOs */}
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 14 }}>🩺 Status dos ASOs (últimos 6 meses)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Em dia', val: d.asoEmDia, cor: '#1D9E75', bg: '#EAF3DE' },
              { label: 'Vencidos', val: d.asoVencidos, cor: '#E24B4A', bg: '#FCEBEB' },
              { label: 'Total registrados', val: d.totalAsos, cor: '#185FA5', bg: '#E6F1FB' },
              { label: 'Funcionários', val: d.totalFuncs, cor: '#374151', bg: '#f9fafb' },
            ].map((it, i) => (
              <div key={i} style={{ background: it.bg, borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: it.cor }}>{it.val}</div>
                <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{it.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tipos de ASO */}
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 14 }}>📋 ASOs por tipo</div>
          {Object.keys(d.asoTipos).length === 0 ? (
            <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '1.5rem' }}>
              Nenhum ASO registrado no período.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(d.asoTipos).map(([tipo, qtd]: any, i) => (
                <div key={i} style={{ padding: '8px 14px', borderRadius: 8, background: '#f9fafb', border: '0.5px solid #e5e7eb', minWidth: 80 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#185FA5' }}>{qtd}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{tipo}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '0.5px solid #f3f4f6' }}>
            <button style={{ ...s.btnOutline, width: '100%', fontSize: 12 }} onClick={() => router.push('/aso')}>
              Ver todos os ASOs →
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #185FA5', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

const s = {
  card:       { background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '1.25rem' },
  btnOutline: { padding: '8px 14px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#374151' },
}
