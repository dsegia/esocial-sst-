import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Empresa = {
  id: string
  razao_social: string
  cnpj: string
  plano: string
  bloqueado?: boolean
  trial_restante: number | null
  trans_mes: number
  trans_pendente: number
  trans_erro: number
  trans_transmitido: number
  trans_mes_passado: number
  variacao_pct: number | null
  funcionarios: number
  responsavel: { nome: string; email: string } | null
  created_at: string
}

type Transmissao = {
  id: string
  empresa_id: string
  empresa_nome: string
  evento: string
  status: string
  created_at: string
  erro: string | null
}

type Totais = {
  empresas: number
  trans_mes: number
  pendente: number
  erros: number
  funcionarios: number
}

const PLANOS = ['trial', 'micro', 'starter', 'pro', 'professional', 'business', 'cancelado']

export default function Admin() {
  const router = useRouter()
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [totais, setTotais] = useState<Totais | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [recentes, setRecentes] = useState<Transmissao[]>([])
  const [busca, setBusca] = useState('')
  const [ordenar, setOrdenar] = useState<'trans_mes' | 'razao_social' | 'created_at' | 'trans_erro'>('trans_mes')
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)
  const [aba, setAba] = useState<'dashboard' | 'clientes' | 'sistema'>('dashboard')

  // Modal novo cliente
  const [modalConvite, setModalConvite] = useState(false)
  const [conviteForm, setConviteForm] = useState({ email: '', razao_social: '', cnpj: '', plano: 'trial' })
  const [conviteStatus, setConviteStatus] = useState<'idle' | 'enviando' | 'ok' | 'erro'>('idle')
  const [conviteErro, setConviteErro] = useState('')

  // Edição de plano inline
  const [editandoPlano, setEditandoPlano] = useState<string | null>(null)
  const [novoPlano, setNovoPlano] = useState('')
  const [salvandoPlano, setSalvandoPlano] = useState(false)

  // Bloqueio inline
  const [bloqueandoId, setBloqueandoId] = useState<string | null>(null)

  // Aba Sistema
  const [sistema, setSistema] = useState<any>(null)
  const [carregandoSistema, setCarregandoSistema] = useState(false)
  const [erroSistema, setErroSistema] = useState('')
  const [marcandoErro, setMarcandoErro] = useState<string | null>(null)

  useEffect(() => {
    carregar()

    // Realtime: recarrega a lista quando uma empresa é inserida ou atualizada
    const canal = supabase
      .channel('admin-empresas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empresas' }, () => {
        carregar()
      })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [])

  useEffect(() => {
    if (aba === 'sistema') carregarSistema()
  }, [aba])

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const resp = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await resp.json()

      if (resp.status === 403) { router.push('/dashboard'); return }
      if (!resp.ok) throw new Error(json.erro || 'Erro ao carregar dados')

      setTotais(json.totais)
      setEmpresas(json.empresas)
      setRecentes(json.recentes)
      setAtualizadoEm(new Date())
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  async function carregarSistema() {
    setCarregandoSistema(true)
    setErroSistema('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/admin/sistema', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.erro || 'Erro ao carregar')
      setSistema(json)
    } catch (e: any) {
      setErroSistema(e.message)
    } finally {
      setCarregandoSistema(false)
    }
  }

  async function marcarTransmissaoErro(transmissaoId: string) {
    setMarcandoErro(transmissaoId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/admin/sistema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ acao: 'marcar_erro', transmissao_id: transmissaoId }),
      })
      if (resp.ok) carregarSistema()
    } finally {
      setMarcandoErro(null)
    }
  }

  async function enviarConvite(e: React.FormEvent) {
    e.preventDefault()
    setConviteStatus('enviando')
    setConviteErro('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/admin/invite-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(conviteForm),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.erro || 'Erro ao enviar convite')
      setConviteStatus('ok')
      setTimeout(() => {
        setModalConvite(false)
        setConviteStatus('idle')
        setConviteForm({ email: '', razao_social: '', cnpj: '', plano: 'trial' })
        carregar()
      }, 2000)
    } catch (err: any) {
      setConviteStatus('erro')
      setConviteErro(err.message)
    }
  }

  async function alterarPlano(empresaId: string, plano: string) {
    setSalvandoPlano(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/admin/update-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ empresa_id: empresaId, plano }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.erro || 'Erro ao atualizar')
      setEditandoPlano(null)
      carregar()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSalvandoPlano(false)
    }
  }

  async function alterarBloqueio(empresaId: string, bloqueado: boolean) {
    setBloqueandoId(empresaId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/admin/update-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ empresa_id: empresaId, bloqueado }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.erro || 'Erro ao atualizar')
      carregar()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setBloqueandoId(null)
    }
  }

  function fmtData(iso: string) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function fmtDataCurta(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  function corPlano(plano: string) {
    if (plano === 'starter')      return { bg: '#E6F1FB', cor: '#185FA5' }
    if (plano === 'professional') return { bg: '#EAF3DE', cor: '#27500A' }
    if (plano === 'business')     return { bg: '#FAEEDA', cor: '#633806' }
    if (plano === 'cancelado')    return { bg: '#FCEBEB', cor: '#791F1F' }
    return { bg: '#f3f4f6', cor: '#6b7280' } // trial
  }

  function corStatus(status: string) {
    if (status === 'transmitido') return '#27a048'
    if (status === 'pendente')    return '#EF9F27'
    if (status === 'erro')        return '#dc2626'
    return '#9ca3af'
  }

  function labelPlano(plano: string, trialRestante?: number | null) {
    if (plano === 'trial') return `Trial${trialRestante !== null && trialRestante !== undefined ? ` (${trialRestante}d)` : ''}`
    return plano.charAt(0).toUpperCase() + plano.slice(1)
  }

  const empresasFiltradas = empresas
    .filter(e => {
      if (!busca.trim()) return true
      const t = busca.toLowerCase()
      return e.razao_social.toLowerCase().includes(t)
        || e.cnpj.replace(/\D/g, '').includes(busca.replace(/\D/g, ''))
        || e.responsavel?.email?.toLowerCase().includes(t)
        || e.responsavel?.nome?.toLowerCase().includes(t)
    })
    .sort((a, b) => {
      if (ordenar === 'razao_social') return a.razao_social.localeCompare(b.razao_social)
      if (ordenar === 'trans_erro')   return b.trans_erro - a.trans_erro
      if (ordenar === 'created_at')   return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return b.trans_mes - a.trans_mes
    })

  const clientesFiltrados = empresas
    .filter(e => {
      if (!busca.trim()) return true
      const t = busca.toLowerCase()
      return e.razao_social.toLowerCase().includes(t)
        || (e.cnpj || '').replace(/\D/g, '').includes(busca.replace(/\D/g, ''))
        || e.responsavel?.email?.toLowerCase().includes(t)
        || e.responsavel?.nome?.toLowerCase().includes(t)
    })
    .sort((a, b) => a.razao_social.localeCompare(b.razao_social))

  if (carregando) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280' }}>
      Carregando painel administrativo...
    </div>
  )

  if (erro) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, color: '#dc2626' }}>{erro}</div>
      <button onClick={carregar} style={{ padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Tentar novamente</button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Head><title>Admin — eSocial SST</title></Head>

      {/* Header */}
      <div style={{ background: '#111827', borderBottom: '1px solid #1f2937', padding: '0 2rem' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 28, background: '#185FA5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="14,3 14,8 19,8"/>
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>eSocial SST</span>
            <span style={{ fontSize: 11, color: '#6b7280', padding: '2px 8px', background: '#1f2937', borderRadius: 4 }}>Admin</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {atualizadoEm && (
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                Atualizado às {atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={carregar} style={{ padding: '6px 12px', background: '#1f2937', border: '1px solid #374151', borderRadius: 6, color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>
              ↻ Atualizar
            </button>
            <button onClick={() => router.push('/dashboard')} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #374151', borderRadius: 6, color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>
              ← Sair do Admin
            </button>
          </div>
        </div>

        {/* Abas */}
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 0 }}>
          {([['dashboard', 'Visão Geral'], ['clientes', 'Clientes'], ['sistema', 'Sistema']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setAba(id); setBusca('') }}
              style={{
                padding: '10px 18px',
                background: 'transparent',
                border: 'none',
                borderBottom: aba === id ? '2px solid #185FA5' : '2px solid transparent',
                color: aba === id ? '#fff' : '#6b7280',
                fontSize: 13,
                fontWeight: aba === id ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem 2rem' }}>

        {/* ===== ABA: VISÃO GERAL ===== */}
        {aba === 'dashboard' && (
          <>
            {/* Cards de totais */}
            {totais && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Empresas ativas', valor: totais.empresas, cor: '#185FA5', bg: '#E6F1FB', icon: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z' },
                  { label: 'Envios este mês', valor: totais.trans_mes, cor: '#27500A', bg: '#EAF3DE', icon: 'M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z' },
                  { label: 'Pendentes', valor: totais.pendente, cor: '#633806', bg: '#FAEEDA', icon: 'M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zM12 6v6l4 2' },
                  { label: 'Com erro', valor: totais.erros, cor: '#791F1F', bg: '#FCEBEB', icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01' },
                  { label: 'Funcionários', valor: totais.funcionarios, cor: '#374151', bg: '#f3f4f6', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z' },
                ].map(c => (
                  <div key={c.label} style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{c.label}</span>
                      <div style={{ width: 28, height: 28, background: c.bg, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c.cor} strokeWidth="2">
                          <path d={c.icon}/>
                        </svg>
                      </div>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#111' }}>{c.valor.toLocaleString('pt-BR')}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

              {/* Tabela de empresas */}
              <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '0.5px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 2 }}>
                      Empresas ({empresasFiltradas.length})
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar empresa, CNPJ ou responsável..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 7, width: 240, fontFamily: 'inherit' }}
                  />
                  <select
                    value={ordenar}
                    onChange={e => setOrdenar(e.target.value as any)}
                    style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 7, fontFamily: 'inherit' }}
                  >
                    <option value="trans_mes">↓ Mais envios</option>
                    <option value="trans_erro">↓ Com erros</option>
                    <option value="razao_social">A–Z Nome</option>
                    <option value="created_at">↓ Mais recentes</option>
                  </select>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb' }}>
                        {['Empresa', 'Responsável', 'Plano', 'Envios/mês', 'Variação', 'Pendente', 'Erro', 'Funcionários', 'Desde'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {empresasFiltradas.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>Nenhuma empresa encontrada</td>
                        </tr>
                      ) : empresasFiltradas.map((emp, idx) => {
                        const { bg, cor } = corPlano(emp.plano)
                        return (
                          <tr key={emp.id} style={{ borderBottom: '0.5px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                              <div style={{ fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.razao_social}</div>
                              <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 1 }}>{emp.cnpj}</div>
                            </td>
                            <td style={{ padding: '10px 12px', maxWidth: 160 }}>
                              {emp.responsavel ? (
                                <>
                                  <div style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.responsavel.nome}</div>
                                  <div style={{ color: '#9ca3af', fontSize: 11 }}>{emp.responsavel.email}</div>
                                </>
                              ) : <span style={{ color: '#9ca3af' }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ padding: '2px 8px', background: bg, color: cor, borderRadius: 99, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                                {labelPlano(emp.plano, emp.trial_restante)}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111' }}>
                              {emp.trans_mes.toLocaleString('pt-BR')}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {emp.variacao_pct === null ? (
                                <span style={{ color: '#9ca3af' }}>—</span>
                              ) : (
                                <span style={{ color: emp.variacao_pct >= 0 ? '#27a048' : '#dc2626', fontWeight: 500 }}>
                                  {emp.variacao_pct >= 0 ? '▲' : '▼'} {Math.abs(emp.variacao_pct)}%
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {emp.trans_pendente > 0
                                ? <span style={{ color: '#EF9F27', fontWeight: 600 }}>{emp.trans_pendente}</span>
                                : <span style={{ color: '#9ca3af' }}>0</span>}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {emp.trans_erro > 0
                                ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{emp.trans_erro}</span>
                                : <span style={{ color: '#9ca3af' }}>0</span>}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#374151' }}>
                              {emp.funcionarios.toLocaleString('pt-BR')}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                              {fmtDataCurta(emp.created_at)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Feed de transmissões recentes */}
              <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '0.5px solid #f3f4f6' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Últimas transmissões</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Todas as empresas</div>
                </div>
                <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                  {recentes.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Nenhuma transmissão</div>
                  ) : recentes.map(t => (
                    <div key={t.id} style={{ padding: '10px 14px', borderBottom: '0.5px solid #f3f4f6', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: corStatus(t.status), flexShrink: 0, marginTop: 4 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#111' }}>{t.evento}</span>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>·</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: corStatus(t.status) }}>{t.status}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.empresa_nome}
                        </div>
                        {t.erro && (
                          <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.erro}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{fmtData(t.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </>
        )}

        {/* ===== ABA: CLIENTES ===== */}
        {aba === 'clientes' && (
          <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>

            {/* Cabeçalho da aba */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '0.5px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111', display: 'flex', alignItems: 'center', gap: 10 }}>
                  Clientes ({clientesFiltrados.length})
                  {(() => {
                    const trials = empresas.filter(e => e.plano === 'trial' && (e.trial_restante ?? 0) > 0)
                    const expirados = empresas.filter(e => e.plano === 'trial' && (e.trial_restante ?? 1) <= 0)
                    return (
                      <>
                        {trials.length > 0 && (
                          <span style={{ fontSize: 11, padding: '2px 8px', background: '#E6F1FB', color: '#185FA5', borderRadius: 99, fontWeight: 600 }}>
                            {trials.length} trial{trials.length > 1 ? 's' : ''} ativo{trials.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {expirados.length > 0 && (
                          <span style={{ fontSize: 11, padding: '2px 8px', background: '#FAEEDA', color: '#633806', borderRadius: 99, fontWeight: 600 }}>
                            {expirados.length} expirado{expirados.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </>
                    )
                  })()}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Atualização em tempo real · Gerencie planos, convites e acessos</div>
              </div>
              <input
                type="text"
                placeholder="Buscar cliente, CNPJ ou e-mail..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 7, width: 240, fontFamily: 'inherit' }}
              />
              <button
                onClick={() => { setModalConvite(true); setConviteStatus('idle'); setConviteErro('') }}
                style={{ padding: '8px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                + Novo Cliente
              </button>
            </div>

            {/* Tabela de clientes */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb' }}>
                    {['Empresa', 'CNPJ', 'Responsável', 'Plano', 'Status', 'Envios/mês', 'Cadastro', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                        {busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado. Clique em "+ Novo Cliente" para começar.'}
                      </td>
                    </tr>
                  ) : clientesFiltrados.map((emp, idx) => {
                    const { bg, cor } = corPlano(emp.plano)
                    const editando = editandoPlano === emp.id
                    return (
                      <tr key={emp.id} style={{ borderBottom: '0.5px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa', opacity: emp.bloqueado ? 0.6 : 1 }}>
                        <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                          <div style={{ fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.razao_social}</div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {emp.cnpj || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', maxWidth: 180 }}>
                          {emp.responsavel ? (
                            <>
                              <div style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.responsavel.nome || '—'}</div>
                              <div style={{ color: '#9ca3af', fontSize: 11 }}>{emp.responsavel.email}</div>
                            </>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: 11, fontStyle: 'italic' }}>Aguardando ativação</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {editando ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <select
                                value={novoPlano}
                                onChange={e => setNovoPlano(e.target.value)}
                                style={{ fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 6px', fontFamily: 'inherit' }}
                              >
                                {PLANOS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                              </select>
                              <button
                                onClick={() => alterarPlano(emp.id, novoPlano)}
                                disabled={salvandoPlano}
                                style={{ padding: '3px 8px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}
                              >
                                {salvandoPlano ? '...' : 'OK'}
                              </button>
                              <button
                                onClick={() => setEditandoPlano(null)}
                                style={{ padding: '3px 6px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span
                              onClick={() => { setEditandoPlano(emp.id); setNovoPlano(emp.plano) }}
                              title="Clique para alterar plano"
                              style={{ padding: '2px 8px', background: bg, color: cor, borderRadius: 99, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', cursor: 'pointer', display: 'inline-block' }}
                            >
                              {labelPlano(emp.plano, emp.trial_restante)} ✎
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {emp.bloqueado ? (
                            <span style={{ padding: '2px 8px', background: '#FCEBEB', color: '#791F1F', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>Bloqueado</span>
                          ) : emp.plano === 'cancelado' ? (
                            <span style={{ padding: '2px 8px', background: '#f3f4f6', color: '#6b7280', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>Cancelado</span>
                          ) : emp.plano === 'trial' && emp.trial_restante !== null && emp.trial_restante <= 0 ? (
                            <span style={{ padding: '2px 8px', background: '#FAEEDA', color: '#633806', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>Trial expirado</span>
                          ) : (
                            <span style={{ padding: '2px 8px', background: '#EAF3DE', color: '#27500A', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>Ativo</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#374151', fontWeight: 600 }}>
                          {emp.trans_mes.toLocaleString('pt-BR')}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                          {fmtDataCurta(emp.created_at)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button
                            onClick={() => alterarBloqueio(emp.id, !emp.bloqueado)}
                            disabled={bloqueandoId === emp.id}
                            title={emp.bloqueado ? 'Desbloquear acesso' : 'Bloquear acesso'}
                            style={{
                              padding: '4px 10px',
                              background: emp.bloqueado ? '#EAF3DE' : '#FCEBEB',
                              color: emp.bloqueado ? '#27500A' : '#791F1F',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {bloqueandoId === emp.id ? '...' : emp.bloqueado ? '✓ Desbloquear' : '⊘ Bloquear'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* ===== ABA: SISTEMA ===== */}
        {aba === 'sistema' && (
          <div>
            {/* Cabeçalho */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Monitoramento do Sistema</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  {sistema ? `Atualizado às ${new Date(sistema.gerado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Verificando...'}
                </div>
              </div>
              <button
                onClick={carregarSistema}
                disabled={carregandoSistema}
                style={{ padding: '7px 14px', background: '#1f2937', border: '1px solid #374151', borderRadius: 7, color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}
              >
                {carregandoSistema ? 'Verificando...' : '↻ Atualizar agora'}
              </button>
            </div>

            {erroSistema && (
              <div style={{ background: '#FCEBEB', color: '#791F1F', borderRadius: 10, padding: '12px 16px', fontSize: 12, marginBottom: 16 }}>{erroSistema}</div>
            )}

            {carregandoSistema && !sistema && (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '3rem' }}>Verificando serviços...</div>
            )}

            {sistema && (() => {
              const { servicos, transmissoes: tx, api_logs } = sistema

              function statusServico(key: string) {
                const svc = servicos[key]
                if (!svc) return 'cinza'
                if (key === 'govbr') return svc.acessivel ? 'verde' : 'vermelho'
                if (key === 'supabase') return svc.ativo ? 'verde' : 'vermelho'
                if (!svc.key_configurada) return 'vermelho'
                if (!svc.logs_24h) return 'amarelo' // key ok, sem dados ainda
                if (svc.logs_24h.taxa_sucesso === null) return 'amarelo'
                if (svc.logs_24h.taxa_sucesso >= 80) return 'verde'
                if (svc.logs_24h.taxa_sucesso >= 50) return 'amarelo'
                return 'vermelho'
              }

              const corStatus: Record<string, string> = { verde: '#27a048', amarelo: '#EF9F27', vermelho: '#dc2626', cinza: '#9ca3af' }
              const _bgStatus: Record<string, string> = { verde: '#EAF3DE', amarelo: '#FAEEDA', vermelho: '#FCEBEB', cinza: '#f3f4f6' }

              return (
                <>
                  {/* Cards de serviços */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      {
                        key: 'anthropic', label: 'Claude (Anthropic)',
                        sub: servicos.anthropic.key_configurada ? 'Key configurada' : 'Key não configurada',
                        detalhe: servicos.anthropic.logs_24h
                          ? `${servicos.anthropic.logs_24h.total} chamadas hoje · ${servicos.anthropic.logs_24h.taxa_sucesso}% OK · ~${servicos.anthropic.logs_24h.media_ms}ms`
                          : api_logs.disponivel ? 'Sem chamadas nas últimas 24h' : 'Sem dados de log',
                        fallbackNote: servicos.anthropic.logs_24h?.fallback > 0 ? `${servicos.anthropic.logs_24h.fallback}x fallback para Gemini` : null,
                      },
                      {
                        key: 'gemini', label: 'Gemini (Google)',
                        sub: servicos.gemini.key_configurada ? 'Key configurada' : 'Key não configurada',
                        detalhe: servicos.gemini.logs_24h
                          ? `${servicos.gemini.logs_24h.total} chamadas hoje · ${servicos.gemini.logs_24h.taxa_sucesso}% OK · ~${servicos.gemini.logs_24h.media_ms}ms`
                          : api_logs.disponivel ? 'Sem chamadas nas últimas 24h' : 'Sem dados de log',
                        fallbackNote: null,
                      },
                      {
                        key: 'govbr', label: 'eSocial Gov.br',
                        sub: servicos.govbr.acessivel
                          ? `Acessível · ${servicos.govbr.latencia_ms}ms`
                          : `Inacessível${servicos.govbr.erro ? ': ' + servicos.govbr.erro : ''}`,
                        detalhe: `${tx.stats_7d.enviado} enviados · ${tx.stats_7d.rejeitado} rejeitados nos últimos 7 dias`,
                        fallbackNote: null,
                      },
                      {
                        key: 'supabase', label: 'Supabase (DB)',
                        sub: 'Conectado',
                        detalhe: `${tx.stats_7d.total} transmissões registradas (7d)`,
                        fallbackNote: null,
                      },
                    ].map(({ key, label, sub, detalhe, fallbackNote }) => {
                      const st = statusServico(key)
                      return (
                        <div key={key} style={{ background: '#fff', border: `1px solid ${corStatus[st]}30`, borderRadius: 12, padding: '1rem 1.25rem', borderTop: `3px solid ${corStatus[st]}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: corStatus[st], flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{label}</span>
                          </div>
                          <div style={{ fontSize: 11, color: corStatus[st], fontWeight: 600, marginBottom: 4 }}>{sub}</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{detalhe}</div>
                          {fallbackNote && (
                            <div style={{ fontSize: 10, color: '#EF9F27', marginTop: 4 }}>⚠ {fallbackNote}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Auto-heal info */}
                  <div style={{ background: '#E6F1FB', border: '0.5px solid #185FA530', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#185FA5' }}>
                    <strong>Auto-heal ativo:</strong> Se Claude falhar, o sistema tenta automaticamente Gemini como fallback (e vice-versa para ASO).
                    {servicos.anthropic.logs_24h?.fallback > 0 && ` Hoje ocorreram ${servicos.anthropic.logs_24h.fallback} fallbacks.`}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

                    {/* Transmissões presas (pendente > 2h) */}
                    <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: tx.pendentes_presos.length > 0 ? '#EF9F27' : '#27a048' }} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                          Transmissões presas ({tx.pendentes_presos.length})
                        </div>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>pendente &gt; 2h</span>
                      </div>
                      {tx.pendentes_presos.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Nenhuma transmissão presa</div>
                      ) : tx.pendentes_presos.map((t: any) => (
                        <div key={t.id} style={{ padding: '10px 16px', borderBottom: '0.5px solid #f3f4f6', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{t.empresa_nome}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{t.evento} · Tentativas: {t.tentativas}</div>
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>{fmtData(t.criado_em)}</div>
                          </div>
                          <button
                            onClick={() => marcarTransmissaoErro(t.id)}
                            disabled={marcandoErro === t.id}
                            title="Marcar como erro para que a empresa possa reenviar"
                            style={{ padding: '4px 8px', background: '#FCEBEB', color: '#791F1F', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {marcandoErro === t.id ? '...' : 'Marcar erro'}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Transmissões rejeitadas recentes */}
                    <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: tx.rejeitados.length > 0 ? '#dc2626' : '#27a048' }} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                          Rejeitados recentes ({tx.rejeitados.length})
                        </div>
                      </div>
                      {tx.rejeitados.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Nenhuma rejeição</div>
                      ) : tx.rejeitados.slice(0, 8).map((t: any) => (
                        <div key={t.id} style={{ padding: '10px 16px', borderBottom: '0.5px solid #f3f4f6' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{t.empresa_nome}</span>
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>·</span>
                            <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{t.evento}</span>
                          </div>
                          {t.erro_codigo && (
                            <div style={{ fontSize: 11, color: '#374151' }}>Código: {t.erro_codigo}</div>
                          )}
                          {t.erro_descricao && (
                            <div style={{ fontSize: 11, color: '#dc2626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.erro_descricao}</div>
                          )}
                          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{fmtData(t.criado_em)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Log de chamadas IA */}
                  <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Log de chamadas IA — últimas 24h</div>
                      {!api_logs.disponivel && (
                        <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Tabela api_logs criada — dados aparecerão nas próximas leituras de documentos</span>
                      )}
                    </div>
                    {api_logs.ultimas.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                        Nenhuma chamada registrada. Importe um documento para começar a registrar.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb' }}>
                              {['Serviço', 'Modelo', 'Status', 'Tipo doc', 'Tempo', 'Horário', 'Erro'].map(h => (
                                <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {api_logs.ultimas.map((log: any, i: number) => {
                              const corLog = log.status === 'ok' ? '#27a048' : log.status === 'fallback' ? '#EF9F27' : '#dc2626'
                              return (
                                <tr key={i} style={{ borderBottom: '0.5px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#374151' }}>{log.servico}</td>
                                  <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 11 }}>{log.modelo || '—'}</td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <span style={{ padding: '2px 7px', background: corLog + '20', color: corLog, borderRadius: 99, fontWeight: 700, fontSize: 10 }}>
                                      {log.status}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#6b7280' }}>{log.tipo || '—'}</td>
                                  <td style={{ padding: '8px 12px', color: '#374151', whiteSpace: 'nowrap' }}>
                                    {log.duracao_ms != null ? `${log.duracao_ms}ms` : '—'}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#9ca3af', whiteSpace: 'nowrap', fontSize: 11 }}>
                                    {fmtData(log.criado_em)}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#dc2626', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {log.erro || '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        )}

      </div>

      {/* ===== MODAL: NOVO CLIENTE ===== */}
      {modalConvite && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setModalConvite(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}
        >
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, padding: '1.75rem', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

            {conviteStatus === 'ok' ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6 }}>Convite enviado!</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>O cliente receberá um e-mail para ativar o acesso.</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Novo Cliente</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Um e-mail de convite será enviado automaticamente</div>
                  </div>
                  <button onClick={() => setModalConvite(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>✕</button>
                </div>

                {conviteStatus === 'erro' && conviteErro && (
                  <div style={{ background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F7C1C1', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 14 }}>
                    {conviteErro}
                  </div>
                )}

                <form onSubmit={enviarConvite}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>E-mail *</label>
                    <input
                      style={inp}
                      type="email"
                      required
                      value={conviteForm.email}
                      onChange={e => setConviteForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="contato@empresa.com.br"
                      autoFocus
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>Razão Social *</label>
                    <input
                      style={inp}
                      required
                      value={conviteForm.razao_social}
                      onChange={e => setConviteForm(f => ({ ...f, razao_social: e.target.value }))}
                      placeholder="Nome da empresa"
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>CNPJ</label>
                    <input
                      style={inp}
                      value={conviteForm.cnpj}
                      onChange={e => setConviteForm(f => ({ ...f, cnpj: e.target.value }))}
                      placeholder="00.000.000/0000-00 (opcional)"
                    />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={lbl}>Plano *</label>
                    <select
                      style={{ ...inp, cursor: 'pointer' }}
                      value={conviteForm.plano}
                      onChange={e => setConviteForm(f => ({ ...f, plano: e.target.value }))}
                    >
                      <option value="trial">Trial (14 dias grátis)</option>
                      <option value="micro">Micro (R$ 49/mês)</option>
                      <option value="starter">Starter (R$ 97/mês)</option>
                      <option value="pro">Pro (R$ 197/mês)</option>
                      <option value="professional">Professional (legado)</option>
                      <option value="business">Business (legado)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setModalConvite(false)}
                      style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={conviteStatus === 'enviando'}
                      style={{ flex: 2, padding: '10px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: conviteStatus === 'enviando' ? 'not-allowed' : 'pointer', opacity: conviteStatus === 'enviando' ? 0.7 : 1 }}
                    >
                      {conviteStatus === 'enviando' ? 'Enviando convite...' : 'Enviar Convite'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
