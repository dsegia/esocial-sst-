import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Alerta = {
  funcionario_id: string; nome: string; matricula: string
  setor: string; tipo_alerta: string; data_venc: string; dias_restantes: number
}

export default function Alertas() {
  const router = useRouter()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresaId(user.empresa_id)
    const { data } = await supabase.rpc('get_alertas_vencimento', { p_empresa_id: user.empresa_id })
    setAlertas(data as Alerta[] || [])
    setCarregando(false)
  }

  const filtrados = alertas.filter(a => {
    if (filtro === 'todos') return true
    if (filtro === 'vencido') return a.dias_restantes < 0 || a.tipo_alerta === 'ASO vencido'
    if (filtro === 'critico') return a.dias_restantes >= 0 && a.dias_restantes <= 30
    if (filtro === 'semaso') return a.tipo_alerta === 'Sem ASO'
    return true
  })

  const vencidos = alertas.filter(a => a.dias_restantes < 0 || a.tipo_alerta === 'ASO vencido').length
  const criticos = alertas.filter(a => a.dias_restantes >= 0 && a.dias_restantes <= 30).length
  const semAso   = alertas.filter(a => a.tipo_alerta === 'Sem ASO').length

  if (carregando) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280' }}>Carregando...</div>

  return (
    <Layout pagina="alertas">
      <Head><title>Alertas — eSocial SST</title></Head>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>Alertas de vencimento</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>ASO (NR-7) · LTCAT (NR-9)</div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: '1.25rem' }}>
        {[
          { n: alertas.length, l: 'Total de alertas', c: '#185FA5', f: 'todos' },
          { n: vencidos,       l: 'ASO vencido',      c: '#E24B4A', f: 'vencido' },
          { n: criticos,       l: 'Crítico (≤30 dias)', c: '#EF9F27', f: 'critico' },
          { n: semAso,         l: 'Sem ASO',           c: '#6b7280', f: 'semaso' },
        ].map((k, i) => (
          <div key={i} onClick={() => setFiltro(filtro === k.f ? 'todos' : k.f)}
            style={{ background: '#fff', border: filtro === k.f ? `2px solid ${k.c}` : '0.5px solid #e5e7eb', borderRadius: 12, padding: '1rem', cursor: 'pointer', transition: 'border-color .15s' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.c, marginBottom: 4 }}>{k.n}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: '#9ca3af', fontSize: 13 }}>
            Nenhum alerta {filtro !== 'todos' ? 'neste filtro' : 'no momento'}.
          </div>
        ) : filtrados.map((a, i) => {
          const vencido = a.dias_restantes < 0
          const critico = a.dias_restantes >= 0 && a.dias_restantes <= 30
          const semAsoItem = a.tipo_alerta === 'Sem ASO'
          const cor = vencido || semAsoItem ? '#E24B4A' : critico ? '#EF9F27' : '#1D9E75'
          const bg  = vencido || semAsoItem ? '#FCEBEB' : critico ? '#FAEEDA' : '#f9fafb'
          const diasTxt = semAsoItem ? 'Sem ASO' : vencido ? `Vencido há ${Math.abs(a.dias_restantes)}d` : `Vence em ${a.dias_restantes}d`

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '0.5px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: cor, flexShrink: 0 }}></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{a.nome}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{a.setor} · Matrícula: {a.matricula}</div>
              </div>
              <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: bg, color: cor }}>{diasTxt}</span>
              <button
                onClick={() => router.push(`/s2220?func=${a.funcionario_id}`)}
                style={{ padding: '5px 12px', fontSize: 11, fontWeight: 500, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                Agendar ASO
              </button>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
