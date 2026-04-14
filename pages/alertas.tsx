import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { getEmpresaId } from '../lib/empresa'

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

  // Modal e-mail
  const [modalEmail, setModalEmail] = useState(false)
  const [emailDestino, setEmailDestino] = useState('')
  const [diasAviso, setDiasAviso] = useState(30)
  const [enviando, setEnviando] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{ tipo: 'ok'|'erro'|'preview'; msg: string; html?: string } | null>(null)
  const [abaModal, setAbaModal] = useState<'config'|'preview'>('config')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id, email').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    const empId = getEmpresaId() || user.empresa_id
    setEmpresaId(empId)
    if (user.email) setEmailDestino(user.email)
    const { data } = await supabase.rpc('get_alertas_vencimento', { p_empresa_id: empId })
    setAlertas(data as Alerta[] || [])
    setCarregando(false)
  }

  async function chamarApiEmail(modo: 'preview' | 'enviar') {
    setEnviando(true)
    setEmailStatus(null)
    try {
      const resp = await fetch('/api/notificar-vencimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId, email_destino: emailDestino, dias_aviso: diasAviso, modo }),
      })
      const json = await resp.json()
      if (!resp.ok) {
        setEmailStatus({ tipo: 'erro', msg: json.erro || 'Erro desconhecido' })
      } else if (modo === 'preview') {
        setEmailStatus({ tipo: 'preview', msg: `Preview gerado — ${json.total_alertas} alerta(s)`, html: json.html })
        setAbaModal('preview')
      } else {
        setEmailStatus({ tipo: 'ok', msg: `E-mail enviado com sucesso para ${emailDestino} (${json.total_alertas} alerta(s))` })
      }
    } catch (e: any) {
      setEmailStatus({ tipo: 'erro', msg: 'Falha de rede: ' + e.message })
    } finally {
      setEnviando(false)
    }
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>Alertas de vencimento</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>ASO (NR-7) · LTCAT (NR-9)</div>
        </div>
        <button
          onClick={() => { setModalEmail(true); setEmailStatus(null); setAbaModal('config') }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ✉ Enviar alerta por e-mail
        </button>
      </div>

      {/* Modal e-mail */}
      {modalEmail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setModalEmail(false) }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: abaModal === 'preview' ? 700 : 460, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>

            {/* Header modal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Notificação de vencimento por e-mail</div>
              <button onClick={() => setModalEmail(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
              {(['config', 'preview'] as const).map(t => (
                <button key={t} onClick={() => setAbaModal(t)}
                  style={{ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', borderBottom: abaModal === t ? '2px solid #185FA5' : '2px solid transparent', color: abaModal === t ? '#185FA5' : '#6b7280', cursor: 'pointer' }}>
                  {t === 'config' ? 'Configurar' : 'Preview do e-mail'}
                </button>
              ))}
            </div>

            {/* Conteúdo */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {abaModal === 'config' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>E-mail de destino *</label>
                    <input
                      type="email" value={emailDestino} onChange={e => setEmailDestino(e.target.value)}
                      placeholder="email@empresa.com.br"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Avisar com antecedência de <strong>{diasAviso} dias</strong>
                    </label>
                    <input type="range" min={7} max={90} step={7} value={diasAviso}
                      onChange={e => setDiasAviso(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#185FA5' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      <span>7 dias</span><span>90 dias</span>
                    </div>
                  </div>

                  {/* Resumo alertas */}
                  <div style={{ background: '#f9fafb', borderRadius: 10, padding: 14, fontSize: 13, color: '#374151' }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Alertas que serão incluídos:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div>Vencidos: <strong style={{ color: '#E24B4A' }}>{vencidos}</strong></div>
                      <div>Sem ASO: <strong style={{ color: '#6b7280' }}>{semAso}</strong></div>
                      <div>Vencem em {diasAviso}d: <strong style={{ color: '#EF9F27' }}>
                        {alertas.filter(a => a.dias_restantes >= 0 && a.dias_restantes <= diasAviso).length}
                      </strong></div>
                      <div>Total: <strong style={{ color: '#185FA5' }}>{alertas.filter(a => a.tipo_alerta === 'Sem ASO' || a.tipo_alerta === 'ASO vencido' || (a.dias_restantes >= 0 && a.dias_restantes <= diasAviso)).length}</strong></div>
                    </div>
                  </div>

                  {emailStatus && (
                    <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                      background: emailStatus.tipo === 'ok' ? '#EDFAF4' : emailStatus.tipo === 'erro' ? '#FCEBEB' : '#EFF6FF',
                      color: emailStatus.tipo === 'ok' ? '#1D9E75' : emailStatus.tipo === 'erro' ? '#E24B4A' : '#185FA5',
                      border: `1px solid ${emailStatus.tipo === 'ok' ? '#A7F3D0' : emailStatus.tipo === 'erro' ? '#FECACA' : '#BFDBFE'}` }}>
                      {emailStatus.tipo === 'ok' ? '✓ ' : emailStatus.tipo === 'erro' ? '✕ ' : 'ℹ '}{emailStatus.msg}
                    </div>
                  )}
                </div>
              )}

              {abaModal === 'preview' && (
                <div>
                  {emailStatus?.html ? (
                    <iframe srcDoc={emailStatus.html} style={{ width: '100%', height: 500, border: '1px solid #e5e7eb', borderRadius: 8 }} title="Preview e-mail" />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontSize: 13 }}>
                      Clique em "Visualizar preview" para ver o e-mail antes de enviar.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalEmail(false)}
                style={{ padding: '8px 16px', fontSize: 13, background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
                Fechar
              </button>
              <button onClick={() => chamarApiEmail('preview')} disabled={enviando || !empresaId}
                style={{ padding: '8px 16px', fontSize: 13, background: '#EFF6FF', color: '#185FA5', border: '1px solid #BFDBFE', borderRadius: 8, cursor: enviando ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                {enviando ? 'Gerando...' : 'Visualizar preview'}
              </button>
              <button onClick={() => chamarApiEmail('enviar')} disabled={enviando || !emailDestino || !empresaId}
                style={{ padding: '8px 16px', fontSize: 13, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, cursor: (enviando || !emailDestino) ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (!emailDestino || enviando) ? .6 : 1 }}>
                {enviando ? 'Enviando...' : '✉ Enviar agora'}
              </button>
            </div>
          </div>
        </div>
      )}

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
