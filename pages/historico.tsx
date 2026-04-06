// =====================================================
// pages/historico.tsx
// Cole este conteúdo em: pages/historico.tsx
// =====================================================
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Tx = {
  id: string; evento: string; status: string; recibo: string | null
  dt_envio: string | null; tentativas: number; erro_descricao: string | null
  criado_em: string; funcionarios: { nome: string; matricula_esocial: string } | null
}

export default function Historico() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [lista, setLista] = useState<Tx[]>([])
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroEvento, setFiltroEvento] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresaId(user.empresa_id)
    await carregar(user.empresa_id, '', '')
    setCarregando(false)
  }

  async function carregar(eId: string, status: string, evento: string) {
    let q = supabase.from('transmissoes')
      .select('id, evento, status, recibo, dt_envio, tentativas, erro_descricao, criado_em, funcionarios(nome, matricula_esocial)')
      .eq('empresa_id', eId)
      .order('criado_em', { ascending: false })
      .limit(100)
    if (status) q = q.eq('status', status)
    if (evento) q = q.eq('evento', evento)
    const { data } = await q
    setLista(data as unknown as Tx[] || [])
  }

  function statusBadge(status: string) {
    const map: Record<string, { bg: string; cor: string; lbl: string }> = {
      enviado:   { bg: '#EAF3DE', cor: '#27500A', lbl: 'Enviado' },
      lote:      { bg: '#EAF3DE', cor: '#27500A', lbl: 'Lote' },
      rejeitado: { bg: '#FCEBEB', cor: '#791F1F', lbl: 'Rejeitado' },
      pendente:  { bg: '#FAEEDA', cor: '#633806', lbl: 'Pendente' },
    }
    const m = map[status] || { bg: '#f3f4f6', cor: '#6b7280', lbl: status }
    return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: m.bg, color: m.cor }}>{m.lbl}</span>
  }

  if (carregando) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280' }}>Carregando...</div>

  return (
    <Layout pagina="historico">
      <Head><title>Histórico — eSocial SST</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>Histórico de transmissões</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{lista.length} registro(s)</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={inp} value={filtroEvento} onChange={e => { setFiltroEvento(e.target.value); carregar(empresaId, filtroStatus, e.target.value) }}>
            <option value="">Todos os eventos</option>
            <option>S-2210</option><option>S-2220</option><option>S-2240</option>
          </select>
          <select style={inp} value={filtroStatus} onChange={e => { setFiltroStatus(e.target.value); carregar(empresaId, e.target.value, filtroEvento) }}>
            <option value="">Todos os status</option>
            <option value="enviado">Enviado</option>
            <option value="rejeitado">Rejeitado</option>
            <option value="pendente">Pendente</option>
          </select>
        </div>
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Evento', 'Trabalhador', 'Data/hora', 'Recibo', 'Status', 'Tentativas'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb', textTransform: 'uppercase' as const }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Nenhuma transmissão ainda.</td></tr>
            ) : lista.map(tx => (
              <tr key={tx.id} style={{ borderBottom: '0.5px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    background: tx.evento === 'S-2210' ? '#FCEBEB' : tx.evento === 'S-2220' ? '#E6F1FB' : '#FAEEDA',
                    color: tx.evento === 'S-2210' ? '#791F1F' : tx.evento === 'S-2220' ? '#0C447C' : '#633806' }}>
                    {tx.evento}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 500 }}>{tx.funcionarios?.nome || '—'}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{tx.funcionarios?.matricula_esocial}</div>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>
                  {tx.dt_envio ? new Date(tx.dt_envio).toLocaleString('pt-BR') : new Date(tx.criado_em).toLocaleString('pt-BR')}
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#374151' }}>
                  {tx.recibo ? tx.recibo.slice(-10) : '—'}
                </td>
                <td style={{ padding: '10px 12px' }}>{statusBadge(tx.status)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: tx.tentativas > 1 ? '#E24B4A' : '#374151' }}>
                  {tx.tentativas}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lista.some(t => t.status === 'rejeitado') && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 8 }}>Motivos de rejeição</div>
          {lista.filter(t => t.status === 'rejeitado').map(tx => (
            <div key={tx.id} style={{ background: '#FCEBEB', border: '0.5px solid #F7C1C1', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#791F1F', marginBottom: 6 }}>
              <strong>{tx.evento}</strong> · {tx.funcionarios?.nome} — {tx.erro_descricao || 'Erro não especificado'}
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

const inp: React.CSSProperties = { padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', fontFamily: 'inherit' }
