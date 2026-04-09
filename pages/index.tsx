import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setErro('')
    setInfo('Conectando...')
    setCarregando(true)

    try {
      setInfo('Verificando credenciais...')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      })

      if (error) {
        setInfo('')
        setErro('Erro de login: ' + error.message)
        setCarregando(false)
        return
      }

      if (!data.session) {
        setInfo('')
        setErro('Sessão não criada. Tente novamente.')
        setCarregando(false)
        return
      }

      setInfo('Login OK! Verificando cadastro...')

      // Verifica se tem registro na tabela usuarios
      const { data: usuario, error: uErr } = await supabase
        .from('usuarios')
        .select('id, nome, empresa_id, perfil')
        .eq('id', data.user.id)
        .single()

      if (uErr || !usuario) {
        setInfo('')
        setErro('Usuário autenticado mas sem cadastro no sistema. Rode o SQL de vinculação no Supabase.')
        setCarregando(false)
        return
      }

      setInfo('Tudo certo! Redirecionando...')
      router.push('/dashboard')

    } catch (err) {
      setInfo('')
      setErro('Erro inesperado: ' + err.message)
      setCarregando(false)
    }
  }

  return (
    <>
      <Head><title>eSocial SST — Entrar</title></Head>
      <div style={s.page}>
        <div style={s.card}>

          <div style={s.logoWrap}>
            <div style={s.logoBox}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="14,3 14,8 19,8"/>
              </svg>
            </div>
            <div>
              <div style={s.logoTitle}>eSocial SST</div>
              <div style={s.logoSub}>Transmissor · S-2210 · S-2220 · S-2240</div>
            </div>
          </div>

          <div style={{ fontSize:14, fontWeight:600, color:'#111', marginBottom:20 }}>Entrar no sistema</div>

          <form onSubmit={handleLogin}>
            <div style={s.field}>
              <label style={s.label}>E-mail</label>
              <input
                style={s.input}
                type="email"
                placeholder="admin@esocial.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Senha</label>
              <input
                style={s.input}
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
              />
            </div>

            {info && (
              <div style={s.infoBox}>
                <span style={{ marginRight:6 }}>⟳</span>{info}
              </div>
            )}

            {erro && (
              <div style={s.erroBox}>{erro}</div>
            )}

            <button
              type="submit"
              style={{ ...s.btnPrimary, opacity: carregando ? 0.7 : 1 }}
              disabled={carregando}
            >
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div style={s.rodape}>
            Não tem conta? Crie pelo Supabase → Authentication → Add user
          </div>

        </div>
      </div>
    </>
  )
}

const s = {
  page:     { minHeight:'100vh', background:'#f4f6f9', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'1rem', fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  card:     { background:'#fff', borderRadius:16, border:'0.5px solid #e5e7eb', padding:'2rem', width:'100%', maxWidth:400 },
  logoWrap: { display:'flex', alignItems:'center', gap:12, marginBottom:20 },
  logoBox:  { width:44, height:44, background:'#185FA5', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  logoTitle:{ fontSize:16, fontWeight:600, color:'#111' },
  logoSub:  { fontSize:11, color:'#6b7280', marginTop:1 },
  field:    { marginBottom:14 },
  label:    { display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:5 },
  input:    { width:'100%', padding:'9px 12px', fontSize:14, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' },
  infoBox:  { background:'#E6F1FB', color:'#0C447C', border:'0.5px solid #B5D4F4', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 },
  erroBox:  { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14, lineHeight:1.5 },
  btnPrimary:{ width:'100%', padding:'11px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' },
  rodape:   { marginTop:12, fontSize:11, color:'#9ca3af', textAlign:'center', lineHeight:1.6 },
}
