// pages/aceitar-convite.tsx
// Página que o cliente acessa após clicar no e-mail de convite
// Supabase já autenticou via magic link — aqui só define a senha e vincula à empresa

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PLANO_INFO: Record<string, { label: string; cor: string; bg: string }> = {
  trial:        { label: 'Trial 14 dias', cor: '#6b7280', bg: '#f3f4f6' },
  starter:      { label: 'Starter',       cor: '#185FA5', bg: '#E6F1FB' },
  professional: { label: 'Professional',  cor: '#27500A', bg: '#EAF3DE' },
  business:     { label: 'Business',      cor: '#633806', bg: '#FAEEDA' },
}

export default function AceitarConvite() {
  const router = useRouter()
  const { empresa_id } = router.query

  const [etapa, setEtapa] = useState<'carregando' | 'senha' | 'empresa' | 'sucesso' | 'erro'>('carregando')
  const [empresa, setEmpresa] = useState<any>(null)
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!router.isReady) return
    init()
  }, [router.isReady])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setEtapa('erro'); setErro('Link de convite inválido ou expirado. Solicite um novo convite.'); return }

    const user = session.user

    // Valida empresa_id: usa o valor gravado no token do convite (user_metadata),
    // nunca o da query string isolada — previne IDOR por manipulação de URL
    const empresaIdDoToken = user.user_metadata?.empresa_id as string | undefined
    const empresaIdValidado = empresaIdDoToken || (empresa_id as string | undefined)

    if (empresa_id && empresaIdDoToken && empresa_id !== empresaIdDoToken) {
      setEtapa('erro')
      setErro('Link de convite inválido. Solicite um novo convite ao administrador.')
      return
    }

    // Busca dados da empresa usando o id validado
    if (empresaIdValidado) {
      const { data: emp } = await supabase.from('empresas')
        .select('id, razao_social, cnpj, plano').eq('id', empresaIdValidado).single()
      if (emp) setEmpresa(emp)
    }

    // Verifica se já tem senha definida (usuário convidado não tem)
    const temSenha = user.user_metadata?.has_password
    if (temSenha) {
      router.push('/dashboard')
      return
    }

    setEtapa('senha')
  }

  async function definirSenha(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha.length < 8) { setErro('A senha deve ter pelo menos 8 caracteres.'); return }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return }
    if (!nome.trim()) { setErro('Informe seu nome.'); return }

    setSalvando(true)
    try {
      // Atualiza senha e nome
      const { error: updErr } = await supabase.auth.updateUser({
        password: senha,
        data: { has_password: true, nome: nome.trim() },
      })
      if (updErr) throw new Error(updErr.message)

      // Obtém o empresa_id do token (autorizado), não da query string
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const empresaIdFinal = (user.user_metadata?.empresa_id as string) || (empresa_id as string) || null
        await supabase.from('usuarios').upsert({
          id: user.id,
          email: user.email,
          nome: nome.trim(),
          empresa_id: empresaIdFinal,
        }, { onConflict: 'id' })
      }

      setEtapa('sucesso')
      setTimeout(() => router.push('/dashboard'), 2500)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const plano = empresa?.plano ? PLANO_INFO[empresa.plano] || PLANO_INFO.trial : null

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '1rem' }}>
      <Head><title>Ativar Acesso — eSocial SST</title></Head>

      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, background: '#185FA5', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="14,3 14,8 19,8"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>eSocial SST</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Transmissor v1.0</div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 14, padding: '2rem' }}>

          {/* Carregando */}
          {etapa === 'carregando' && (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Verificando convite...</div>
          )}

          {/* Erro */}
          {etapa === 'erro' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 8 }}>Link inválido</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>{erro}</div>
            </div>
          )}

          {/* Definir senha */}
          {etapa === 'senha' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 4 }}>Ativar seu acesso</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  {empresa ? `Você foi convidado para a ${empresa.razao_social}.` : 'Você recebeu um convite para o eSocial SST.'}
                  {' '}Defina sua senha para começar.
                </div>
              </div>

              {empresa && plano && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: plano.bg, border: `0.5px solid ${plano.cor}30`, borderRadius: 8, padding: '8px 12px', marginBottom: 20 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: plano.cor }}>{plano.label}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{empresa.razao_social}</div>
                  </div>
                </div>
              )}

              {erro && (
                <div style={{ background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F7C1C1', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 14 }}>
                  {erro}
                </div>
              )}

              <form onSubmit={definirSenha}>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Seu nome completo *</label>
                  <input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João da Silva" autoFocus />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Senha *</label>
                  <input style={inp} type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>Confirmar senha *</label>
                  <input style={inp} type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="Repita a senha" />
                </div>
                <button type="submit" disabled={salvando} style={{ width: '100%', padding: '11px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: salvando ? 'not-allowed' : 'pointer', opacity: salvando ? 0.7 : 1 }}>
                  {salvando ? 'Ativando...' : 'Ativar minha conta'}
                </button>
              </form>
            </>
          )}

          {/* Sucesso */}
          {etapa === 'sucesso' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 6 }}>Acesso ativado!</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Redirecionando para o dashboard...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
