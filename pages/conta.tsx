import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { getEmpresaId } from '../lib/empresa'
import { PLANOS, PlanoStatus, TipoPlano } from '../types/database'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Conta() {
  const router = useRouter()
  const [status, setStatus] = useState<PlanoStatus | null>(null)
  const [email, setEmail] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [upgradando, setUpgradando] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    // Feedback pós-checkout
    if (router.query.sucesso) setMsg(`Assinatura do plano ${router.query.plano || ''} ativada com sucesso!`)
    if (router.query.cancelado) setMsg('Checkout cancelado. Seu plano não foi alterado.')
    init()
  }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setEmail(session.user.email || '')

    const empresaId = getEmpresaId()
    if (!empresaId) { router.push('/empresas'); return }

    const { data } = await supabase.rpc('get_plano_empresa', { p_empresa_id: empresaId })
    setStatus(data as PlanoStatus)
    setCarregando(false)
  }

  async function fazerUpgrade(plano: TipoPlano) {
    if (plano === 'trial' || plano === 'cancelado') return
    setUpgradando(plano)
    setMsg('')
    const empresaId = getEmpresaId()

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ plano, empresa_id: empresaId, user_email: email }),
    })
    const json = await res.json()

    if (json.url) {
      window.location.href = json.url
    } else {
      setMsg('Erro ao criar checkout: ' + (json.erro || 'tente novamente'))
      setUpgradando('')
    }
  }

  if (carregando) return (
    <Layout pagina="conta">
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: '#9ca3af', fontSize: 13 }}>Carregando...</div>
    </Layout>
  )

  const planoAtual = status?.plano || 'trial'
  const planosVisiveis = ['micro', 'starter', 'pro'] as TipoPlano[]

  return (
    <Layout pagina="conta">
      <Head><title>Minha Conta — eSocial SST</title></Head>

      <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 4 }}>Minha Conta</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 24 }}>{email}</div>

      {msg && (
        <div style={{
          background: router.query.sucesso ? '#EAF3DE' : '#FCEBEB',
          color: router.query.sucesso ? '#27500A' : '#791F1F',
          border: `0.5px solid ${router.query.sucesso ? '#C0DD97' : '#F7C1C1'}`,
          borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 20,
        }}>{msg}</div>
      )}

      {/* Status atual */}
      <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 12 }}>Plano atual</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{
            padding: '4px 14px', borderRadius: 99, fontSize: 13, fontWeight: 700,
            background: PLANOS[planoAtual]?.cor + '18',
            color: PLANOS[planoAtual]?.cor,
            border: `1px solid ${PLANOS[planoAtual]?.cor}40`,
          }}>
            {PLANOS[planoAtual]?.label || planoAtual.toUpperCase()}
          </div>

          {status?.trial_ativo && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Trial: <strong>{status.trial_dias_restantes} dias restantes</strong>
            </div>
          )}
          {status?.plano_expira_em && !status.trial_ativo && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Renova em: <strong>{new Date(status.plano_expira_em).toLocaleDateString('pt-BR')}</strong>
            </div>
          )}

          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
            Funcionários cadastrados: <strong>{status?.qtd_funcionarios}</strong>
          </div>
        </div>

        {(planoAtual === 'trial' || planoAtual === 'cancelado') && (
          <div style={{ marginTop: 12, background: '#FFF8E6', border: '0.5px solid #F5D78A', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#7a4f00' }}>
            {planoAtual === 'trial'
              ? `Você tem ${status?.trial_dias_restantes} dias de trial. Escolha um plano abaixo para continuar sem interrupções.`
              : 'Sua assinatura foi cancelada. Escolha um plano abaixo para reativar o acesso.'}
          </div>
        )}
      </div>

      {/* Cards de planos */}
      <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12 }}>Escolher plano</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: '2rem' }}>
        {planosVisiveis.map(p => {
          const info = PLANOS[p]
          const isCurrent = p === planoAtual
          const isPopular = p === 'starter'

          return (
            <div key={p} style={{
              background: '#fff',
              border: isCurrent ? `2px solid ${info.cor}` : '0.5px solid #e5e7eb',
              borderRadius: 12, padding: '1.25rem',
              position: 'relative',
              boxShadow: isCurrent ? `0 0 0 4px ${info.cor}18` : 'none',
            }}>
              {isPopular && !isCurrent && (
                <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#7c3aed', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 99 }}>
                  MAIS POPULAR
                </div>
              )}
              {isCurrent && (
                <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: info.cor, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 99 }}>
                  PLANO ATUAL
                </div>
              )}

              <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>{info.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: info.cor, marginBottom: 4 }}>
                R$ {info.preco}<span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>/mês</span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                {info.envios ? `${info.envios} envios/mês incluídos` : info.max === 999999 ? 'Funcionários ilimitados' : `Até ${info.max} funcionários`}
              </div>
              {info.excedente && (
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 10 }}>{info.excedente}</div>
              )}

              {[
                'Importação por IA (PDF)',
                'Transmissão eSocial',
                'Alertas de vencimento',
                p === 'starter' ? 'Multi-empresa (até 5 CNPJs)' : null,
                p === 'starter' ? 'Convite de usuários' : null,
                p === 'pro' ? 'Até 10 CNPJs' : null,
                p === 'pro' ? 'Suporte prioritário' : null,
                p === 'pro' ? 'Onboarding dedicado' : null,
              ].filter(Boolean).map(feat => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151', marginBottom: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={info.cor} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  {feat}
                </div>
              ))}

              <button
                onClick={() => fazerUpgrade(p)}
                disabled={isCurrent || upgradando === p}
                style={{
                  width: '100%', marginTop: 14, padding: '9px',
                  background: isCurrent ? '#f3f4f6' : info.cor,
                  color: isCurrent ? '#9ca3af' : '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: isCurrent ? 'not-allowed' : 'pointer',
                  opacity: upgradando === p ? 0.7 : 1,
                }}>
                {upgradando === p ? 'Aguarde...' : isCurrent ? 'Plano ativo' : 'Assinar'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Informações adicionais */}
      <div style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '1rem 1.25rem', fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
        <strong style={{ color: '#374151' }}>Sobre os planos:</strong><br/>
        • Pagamento mensal via cartão de crédito — sem fidelidade<br/>
        • Cancele a qualquer momento pelo painel ou e-mail<br/>
        • Upgrade imediato, sem precisar recadastrar dados<br/>
        • Nota fiscal emitida mensalmente por e-mail<br/>
        • Dúvidas: <a href="mailto:suporte@esocialsst.com.br" style={{ color: '#185FA5' }}>suporte@esocialsst.com.br</a>
      </div>

    </Layout>
  )
}
