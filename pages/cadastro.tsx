import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import { setEmpresaId, setMultiEmpresa } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Etapa = 'form' | 'sucesso'

const formVazio = () => ({
  nome: '',
  email: '',
  senha: '',
  confirmar: '',
  razao_social: '',
  cnpj: '',
})

export default function Cadastro() {
  const router = useRouter()
  const [etapa, setEtapa] = useState<Etapa>('form')
  const [form, setForm] = useState(formVazio())
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [carregando, setCarregando] = useState(false)

  function fmtCNPJ(v: string) {
    const n = v.replace(/\D/g, '').slice(0, 14)
    return n.replace(/(\d{2})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2')
  }

  function validar(): string | null {
    if (!form.nome.trim()) return 'Informe seu nome completo.'
    if (!form.email.trim()) return 'Informe seu e-mail.'
    if (form.senha.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
    if (form.senha !== form.confirmar) return 'As senhas não coincidem.'
    if (!form.razao_social.trim()) return 'Informe a razão social da empresa.'
    const cnpj = form.cnpj.replace(/\D/g, '')
    if (cnpj.length !== 14) return 'CNPJ inválido — deve ter 14 dígitos.'
    return null
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const valErr = validar()
    if (valErr) { setErro(valErr); return }

    setCarregando(true)
    setInfo('Criando sua conta...')

    try {
      // 1. Criar usuário no Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.senha,
        options: { data: { nome: form.nome.trim() } },
      })

      if (authErr) {
        setErro('Erro ao criar conta: ' + authErr.message)
        setCarregando(false); setInfo(''); return
      }
      if (!authData.user) {
        setErro('Erro inesperado. Tente novamente.')
        setCarregando(false); setInfo(''); return
      }

      setInfo('Configurando empresa...')

      // 2. Chamar RPC que cria empresa + usuário atomicamente
      const { data: rpcData, error: rpcErr } = await supabase.rpc('criar_conta', {
        p_razao_social: form.razao_social.trim(),
        p_cnpj:         form.cnpj,
        p_user_id:      authData.user.id,
        p_user_nome:    form.nome.trim(),
      })

      if (rpcErr) {
        // Limpa o usuário criado se a empresa falhou
        setErro('Erro ao criar empresa: ' + rpcErr.message)
        setCarregando(false); setInfo(''); return
      }

      const empresaId = rpcData?.empresa_id
      if (empresaId) {
        setMultiEmpresa(false)
        setEmpresaId(empresaId)
      }

      setEtapa('sucesso')
    } catch (err: any) {
      setErro('Erro inesperado: ' + err.message)
    } finally {
      setCarregando(false)
      setInfo('')
    }
  }

  // ── Tela de sucesso ────────────────────────────────────────────────────────
  if (etapa === 'sucesso') {
    return (
      <>
        <Head><title>Conta criada — eSocial SST</title></Head>
        <div style={s.page}>
          <div style={{ ...s.card, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, background: '#EAF3DE', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27500A" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 8 }}>
              Conta criada com sucesso!
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, lineHeight: 1.6 }}>
              Seu trial gratuito de <strong>14 dias</strong> está ativo.
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
              Empresa: <strong>{form.razao_social}</strong><br/>
              Plano: <strong>Trial — até 50 funcionários</strong>
            </div>
            <button onClick={() => router.push('/dashboard')}
              style={s.btnPrimary}>
              Ir para o Dashboard
            </button>
            <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af' }}>
              Para ativar uma assinatura paga, acesse <strong>Conta → Planos</strong>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Formulário de cadastro ─────────────────────────────────────────────────
  return (
    <>
      <Head><title>Criar conta — eSocial SST</title></Head>
      <div style={s.page}>
        <div style={{ ...s.card, maxWidth: 480 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, background: '#185FA5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="14,3 14,8 19,8"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>eSocial SST</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Criar conta — Trial 14 dias grátis</div>
            </div>
          </div>

          {/* Benefícios */}
          <div style={{ background: '#E6F1FB', border: '0.5px solid #B5D4F4', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0C447C', marginBottom: 6 }}>O que você terá no Trial:</div>
            {[
              'Leitura automática de PDFs com IA (ASO, LTCAT, CAT)',
              'Transmissão de eventos S-2210, S-2220, S-2221, S-2240',
              'Até 50 funcionários cadastrados',
              'Alertas de vencimento por e-mail',
            ].map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#185FA5', marginBottom: 3 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {b}
              </div>
            ))}
          </div>

          <form onSubmit={handleCadastro}>
            <div style={s.secao}>Seus dados</div>

            <div style={s.grid2}>
              <div style={s.field}>
                <label style={s.label}>Nome completo *</label>
                <input style={s.input} placeholder="João Silva"
                  value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>E-mail *</label>
                <input style={s.input} type="email" placeholder="joao@empresa.com"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
            </div>

            <div style={s.grid2}>
              <div style={s.field}>
                <label style={s.label}>Senha (mín. 8 caracteres) *</label>
                <input style={s.input} type="password" placeholder="••••••••"
                  value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>Confirmar senha *</label>
                <input style={s.input} type="password" placeholder="••••••••"
                  value={form.confirmar} onChange={e => setForm({ ...form, confirmar: e.target.value })} required />
              </div>
            </div>

            <div style={{ ...s.secao, marginTop: 18 }}>Dados da empresa</div>

            <div style={s.grid2}>
              <div style={s.field}>
                <label style={s.label}>Razão social *</label>
                <input style={s.input} placeholder="Empresa Ltda"
                  value={form.razao_social} onChange={e => setForm({ ...form, razao_social: e.target.value })} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>CNPJ *</label>
                <input style={s.input} placeholder="00.000.000/0001-00"
                  value={form.cnpj} onChange={e => setForm({ ...form, cnpj: fmtCNPJ(e.target.value) })} required />
              </div>
            </div>

            {info && (
              <div style={s.infoBox}><span style={{ marginRight: 6 }}>⟳</span>{info}</div>
            )}
            {erro && (
              <div style={s.erroBox}>{erro}</div>
            )}

            <button type="submit" disabled={carregando}
              style={{ ...s.btnPrimary, opacity: carregando ? 0.7 : 1, marginTop: 4 }}>
              {carregando ? 'Criando conta...' : 'Criar conta grátis — 14 dias de trial'}
            </button>
          </form>

          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
            Já tem uma conta?{' '}
            <a href="/" style={{ color: '#185FA5', textDecoration: 'none', fontWeight: 500 }}>
              Entrar
            </a>
          </div>

          <div style={{ marginTop: 12, fontSize: 10, color: '#c4c4c0', textAlign: 'center', lineHeight: 1.6 }}>
            Ao criar sua conta você concorda com os Termos de Uso.<br/>
            Sem cobrança automática durante o trial.
          </div>

        </div>
      </div>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:     { minHeight: '100vh', background: '#f4f6f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  card:     { background: '#fff', borderRadius: 16, border: '0.5px solid #e5e7eb', padding: '2rem', width: '100%', maxWidth: 400 },
  secao:    { fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 10 },
  grid2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  field:    { marginBottom: 12 },
  label:    { display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 },
  input:    { width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
  infoBox:  { background: '#E6F1FB', color: '#0C447C', border: '0.5px solid #B5D4F4', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  erroBox:  { background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F7C1C1', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14, lineHeight: 1.5 },
  btnPrimary: { width: '100%', padding: '11px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}
