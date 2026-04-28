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

type Tx = {
  id: string
  evento: string
  status: string
  criado_em: string
  erro_descricao: string | null
  tentativas: number
  funcionarios: { nome: string; matricula_esocial: string } | null
}

const EVT_BG: Record<string, string>  = { 'S-2210': '#FCEBEB', 'S-2220': '#E6F1FB', 'S-2221': '#EAF3DE', 'S-2240': '#FAEEDA' }
const EVT_COR: Record<string, string> = { 'S-2210': '#791F1F', 'S-2220': '#0C447C', 'S-2221': '#1D9E75', 'S-2240': '#633806' }
const EVT_ROTA: Record<string, string> = { 'S-2210': '/s2210', 'S-2220': '/s2220', 'S-2221': '/s2221', 'S-2240': '/s2240' }

export default function FilaTransmissao() {
  const router = useRouter()
  const [pendentes, setPendentes]     = useState<Tx[]>([])
  const [rejeitados, setRejeitados]   = useState<Tx[]>([])
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [filtroEvt, setFiltroEvt]     = useState('todos')
  const [aba, setAba]                 = useState<'pendentes' | 'rejeitados'>('pendentes')
  const [carregando, setCarregando]   = useState(true)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: user } = await supabase
      .from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/login'); return }
    const empId = getEmpresaId() || user.empresa_id
    await carregar(empId)
    setCarregando(false)
  }

  async function carregar(empresaId: string) {
    const [pendRes, rejRes] = await Promise.all([
      supabase.from('transmissoes')
        .select('id, evento, status, criado_em, erro_descricao, tentativas, funcionarios(nome, matricula_esocial)')
        .eq('empresa_id', empresaId)
        .eq('status', 'pendente')
        .order('criado_em', { ascending: true }),
      supabase.from('transmissoes')
        .select('id, evento, status, criado_em, erro_descricao, tentativas, funcionarios(nome, matricula_esocial)')
        .eq('empresa_id', empresaId)
        .eq('status', 'rejeitado')
        .order('criado_em', { ascending: false }),
    ])
    setPendentes((pendRes.data || []) as Tx[])
    setRejeitados((rejRes.data || []) as Tx[])
  }

  function diasAtraso(dataStr: string) {
    return Math.floor((Date.now() - new Date(dataStr).getTime()) / 86400000)
  }

  function idadeLabel(dataStr: string) {
    const d = diasAtraso(dataStr)
    if (d === 0) return 'Hoje'
    if (d === 1) return '1 dia atrás'
    return `${d} dias atrás`
  }

  const lista = aba === 'pendentes' ? pendentes : rejeitados
  const listaFiltrada = filtroEvt === 'todos' ? lista : lista.filter(t => t.evento === filtroEvt)
  const eventosPresentes = [...new Set(lista.map(t => t.evento))]

  function toggleSel(id: string) {
    setSelecionados(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  function selecionarTodos() {
    if (selecionados.length === listaFiltrada.length) {
      setSelecionados([])
    } else {
      setSelecionados(listaFiltrada.map(t => t.id))
    }
  }

  function transmitirSelecionados() {
    // Redireciona para transmissao-manual que já tem toda a lógica de certificado + lote
    router.push('/transmissao-manual')
  }

  // Agrupamento por evento para o resumo
  const resumo = ['S-2210', 'S-2220', 'S-2221', 'S-2240'].map(evt => ({
    evt,
    pendente:  pendentes.filter(t => t.evento === evt).length,
    rejeitado: rejeitados.filter(t => t.evento === evt).length,
  })).filter(r => r.pendente > 0 || r.rejeitado > 0)

  // Mais antigo
  const maisAntigo = pendentes.length > 0
    ? diasAtraso(pendentes[pendentes.length - 1]?.criado_em || pendentes[0].criado_em)
    : null

  if (carregando) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #185FA5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <Layout pagina="fila-transmissao">
      <Head><title>Fila de Transmissão — eSocial SST</title></Head>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>📋 Fila de Transmissão</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
            Gerencie eventos pendentes e rejeitados antes de transmitir ao Gov.br
          </div>
        </div>
        <button
          style={{ padding: '10px 20px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          onClick={() => router.push('/transmissao-manual')}>
          📡 Transmitir eventos →
        </button>
      </div>

      {/* Resumo por evento */}
      {resumo.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {resumo.map((r, i) => (
            <div key={i} style={{ background: EVT_BG[r.evt] || '#f9fafb', border: `0.5px solid ${EVT_COR[r.evt]}33`, borderRadius: 10, padding: '10px 16px', minWidth: 100 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: EVT_BG[r.evt], color: EVT_COR[r.evt] }}>{r.evt}</span>
                <button style={{ background: 'none', border: 'none', fontSize: 10, color: EVT_COR[r.evt], cursor: 'pointer', padding: 0 }}
                  onClick={() => router.push(EVT_ROTA[r.evt] || '/s2220')}>
                  Ver →
                </button>
              </div>
              {r.pendente > 0 && <div style={{ fontSize: 11, color: '#374151' }}>⏳ {r.pendente} pendente(s)</div>}
              {r.rejeitado > 0 && <div style={{ fontSize: 11, color: '#E24B4A', marginTop: 2 }}>❌ {r.rejeitado} rejeitado(s)</div>}
            </div>
          ))}
          {maisAntigo !== null && maisAntigo > 3 && (
            <div style={{ background: '#FAEEDA', border: '0.5px solid #FAC77566', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#633806' }}>Evento mais antigo</div>
                <div style={{ fontSize: 11, color: '#633806' }}>há {maisAntigo} dias aguardando</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Abas + filtros */}
      <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '0.5px solid #f3f4f6' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              { key: 'pendentes',  label: `⏳ Pendentes (${pendentes.length})` },
              { key: 'rejeitados', label: `❌ Rejeitados (${rejeitados.length})` },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => { setAba(tab.key); setSelecionados([]) }}
                style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: aba === tab.key ? 600 : 400, cursor: 'pointer', border: 'none', background: aba === tab.key ? '#185FA5' : '#f3f4f6', color: aba === tab.key ? '#fff' : '#374151' }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={filtroEvt} onChange={e => setFiltroEvt(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', color: '#374151', cursor: 'pointer' }}>
              <option value="todos">Todos os eventos</option>
              {eventosPresentes.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            {listaFiltrada.length > 0 && (
              <button onClick={selecionarTodos}
                style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', cursor: 'pointer', color: '#374151' }}>
                {selecionados.length === listaFiltrada.length ? 'Desmarcar todos' : `Selecionar todos (${listaFiltrada.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        {listaFiltrada.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>{aba === 'pendentes' ? '✅' : '🎉'}</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
              {aba === 'pendentes' ? 'Nenhuma transmissão pendente.' : 'Nenhuma transmissão rejeitada.'}
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {aba === 'pendentes' ? 'Todos os eventos foram transmitidos.' : 'Ótimo! Nenhum erro pendente.'}
            </div>
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={s.th}></th>
                  <th style={s.th}>Evento</th>
                  <th style={s.th}>Funcionário</th>
                  <th style={s.th}>Matrícula</th>
                  <th style={s.th}>Criado em</th>
                  <th style={s.th}>Idade</th>
                  <th style={s.th}>Tentativas</th>
                  {aba === 'rejeitados' && <th style={s.th}>Erro</th>}
                  <th style={s.th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((tx, i) => {
                  const sel = selecionados.includes(tx.id)
                  const dias = diasAtraso(tx.criado_em)
                  const idadeCorBg = dias > 7 ? '#FCEBEB' : dias > 3 ? '#FAEEDA' : '#f9fafb'
                  const idadeCorTxt = dias > 7 ? '#791F1F' : dias > 3 ? '#633806' : '#6b7280'
                  return (
                    <tr key={tx.id} style={{ borderBottom: '0.5px solid #f3f4f6', background: sel ? '#EFF6FF' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', width: 36 }}>
                        <input type="checkbox" checked={sel} onChange={() => toggleSel(tx.id)}
                          style={{ width: 15, height: 15, cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: EVT_BG[tx.evento] || '#f3f4f6', color: EVT_COR[tx.evento] || '#374151' }}>
                          {tx.evento}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111' }}>
                        {tx.funcionarios?.nome?.split(' ').slice(0, 2).join(' ') || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>
                        {tx.funcionarios?.matricula_esocial || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {new Date(tx.criado_em).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 500, background: idadeCorBg, color: idadeCorTxt }}>
                          {idadeLabel(tx.criado_em)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', textAlign: 'center' }}>
                        {tx.tentativas || 0}
                      </td>
                      {aba === 'rejeitados' && (
                        <td style={{ padding: '10px 12px', color: '#791F1F', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.erro_descricao || '—'}
                        </td>
                      )}
                      <td style={{ padding: '10px 12px' }}>
                        <button style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#374151' }}
                          onClick={() => router.push(EVT_ROTA[tx.evento] || '/s2220')}>
                          Ver →
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Barra de ação flutuante */}
            {selecionados.length > 0 && (
              <div style={{ padding: '14px 16px', borderTop: '0.5px solid #e5e7eb', background: '#EFF6FF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#185FA5', fontWeight: 500 }}>
                  {selecionados.length} evento(s) selecionado(s)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ padding: '8px 16px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', cursor: 'pointer', color: '#374151' }}
                    onClick={() => setSelecionados([])}>
                    Limpar seleção
                  </button>
                  <button style={{ padding: '8px 18px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 7, background: '#185FA5', color: '#fff', cursor: 'pointer' }}
                    onClick={transmitirSelecionados}>
                    📡 Transmitir selecionados →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dica */}
      {pendentes.length > 0 && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#E6F1FB', borderRadius: 8, fontSize: 12, color: '#0C447C' }}>
          💡 <strong>Dica:</strong> Para transmitir em lote, vá para{' '}
          <button style={{ background: 'none', border: 'none', color: '#185FA5', cursor: 'pointer', fontWeight: 600, fontSize: 12, padding: 0, textDecoration: 'underline' }}
            onClick={() => router.push('/transmissao-manual')}>
            Transmissão Manual
          </button>
          {' '}— carregue o certificado uma vez e transmita todos os eventos selecionados.
        </div>
      )}
    </Layout>
  )
}

const s = {
  th: { padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.04em', whiteSpace: 'nowrap' as const },
}
