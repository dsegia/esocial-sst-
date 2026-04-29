import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import { setEmpresaId, setMultiEmpresa } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Empresa = { id: string; razao_social: string; cnpj: string; perfil?: string }

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [etapa, setEtapa] = useState<'login' | 'selecionar'>('login')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [nomeUser, setNomeUser] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setInfo('Conectando...')
    setCarregando(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      })

      if (error) {
        setInfo(''); setErro('Erro de login: ' + error.message); setCarregando(false); return
      }
      if (!data.session) {
        setInfo(''); setErro('Sessão não criada. Tente novamente.'); setCarregando(false); return
      }

      setInfo('Verificando empresas...')

      const { data: usuario, error: uErr } = await supabase
        .from('usuarios')
        .select('id, nome, empresa_id, perfil')
        .eq('id', data.user.id)
        .single()

      if (uErr || !usuario) {
        setInfo(''); setErro('Usuário sem cadastro no sistema. Rode o SQL de vinculação no Supabase.'); setCarregando(false); return
      }

      setNomeUser(usuario.nome)

      const { data: minhasEmpresas } = await supabase.rpc('get_minhas_empresas')

      if (minhasEmpresas && minhasEmpresas.length > 1) {
        setMultiEmpresa(true)
        setEmpresas(minhasEmpresas)
        setCarregando(false)
        setInfo('')
        setEtapa('selecionar')
      } else {
        const empresaId = (minhasEmpresas && minhasEmpresas.length === 1)
          ? minhasEmpresas[0].id
          : usuario.empresa_id
        setMultiEmpresa(false)
        setEmpresaId(empresaId)
        setInfo('Tudo certo! Redirecionando...')
        router.push('/dashboard')
      }

    } catch (err: any) {
      setInfo(''); setErro('Erro inesperado: ' + err.message); setCarregando(false)
    }
  }

  function selecionarEmpresa(empresa: Empresa) {
    setEmpresaId(empresa.id)
    router.push('/dashboard')
  }

  function fmtCNPJ(cnpj: string) {
    const n = cnpj?.replace(/\D/g, '') || ''
    if (n.length !== 14) return cnpj
    return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`
  }

  if (etapa === 'selecionar') {
    return (
      <>
        <Head><title>eSocial SST — Selecionar empresa</title></Head>
        <div style={s.page}>
          <div style={{ ...s.card, maxWidth: 520 }}>

            <div style={s.logoWrap}>
              <img src="/logo-completa.png" alt="DSEG Consultoria" style={{ height:'80px', width:'auto' }} />
              <div style={{ ...s.logoSub, marginLeft:4 }}>Olá, {nomeUser}</div>
            </div>

            <div style={{ fontSize:14, fontWeight:600, color:'#111', marginBottom:4 }}>Selecionar empresa</div>
            <div style={{ fontSize:12, color:'#6b7280', marginBottom:18 }}>
              Você tem acesso a {empresas.length} empresas. Escolha com qual deseja trabalhar agora.
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {empresas.map((emp) => (
                <button key={emp.id} onClick={() => selecionarEmpresa(emp)}
                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer', textAlign:'left', transition:'border-color .15s, background .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#185FA5'; (e.currentTarget as HTMLButtonElement).style.background = '#f5f9ff' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:38, height:38, borderRadius:8, background:'#E6F1FB', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{emp.razao_social}</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{fmtCNPJ(emp.cnpj)}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {emp.perfil && (
                      <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600, background:'#E6F1FB', color:'#185FA5', textTransform:'uppercase' }}>
                        {emp.perfil}
                      </span>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                      <polyline points="9,18 15,12 9,6"/>
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop:16, textAlign:'center' }}>
              <button onClick={() => { supabase.auth.signOut(); setEtapa('login') }}
                style={{ background:'none', border:'none', fontSize:12, color:'#9ca3af', cursor:'pointer', textDecoration:'underline' }}>
                Sair e usar outra conta
              </button>
            </div>

          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head><title>eSocial SST — Entrar</title></Head>
      <div style={s.page}>
        <div style={s.card}>

          <div style={{ ...s.logoWrap, justifyContent:'center' }}>
            <img src="/logo-completa.png" alt="DSEG Consultoria" style={{ height:'90px', width:'auto' }} />
          </div>

          <div style={{ fontSize:14, fontWeight:600, color:'#111', marginBottom:20 }}>Entrar no sistema</div>

          <form onSubmit={handleLogin}>
            <div style={s.field}>
              <label style={s.label}>E-mail</label>
              <input style={s.input} type="email" placeholder="seu@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div style={s.field}>
              <label style={s.label}>Senha</label>
              <input style={s.input} type="password" placeholder="••••••••"
                value={senha} onChange={e => setSenha(e.target.value)} required />
            </div>

            {info && (
              <div style={s.infoBox}><span style={{ marginRight:6 }}>⟳</span>{info}</div>
            )}
            {erro && (
              <div style={s.erroBox}>{erro}</div>
            )}

            <button type="submit" style={{ ...s.btnPrimary, opacity: carregando ? 0.7 : 1 }} disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div style={s.rodape}>
            Não tem conta?{' '}
            <a href="/cadastro" style={{ color: '#185FA5', fontWeight: 500, textDecoration: 'none' }}>
              Criar conta grátis — trial 14 dias
            </a>
          </div>

        </div>
      </div>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:      { minHeight:'100vh', background:'#f4f6f9', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'1rem', fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  card:      { background:'#fff', borderRadius:16, border:'0.5px solid #e5e7eb', padding:'2rem', width:'100%', maxWidth:400 },
  logoWrap:  { display:'flex', alignItems:'center', gap:12, marginBottom:20 },
  logoBox:   { width:44, height:44, background:'#185FA5', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  logoTitle: { fontSize:16, fontWeight:600, color:'#111' },
  logoSub:   { fontSize:11, color:'#6b7280', marginTop:1 },
  field:     { marginBottom:14 },
  label:     { display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:5 },
  input:     { width:'100%', padding:'9px 12px', fontSize:14, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' },
  infoBox:   { background:'#E6F1FB', color:'#0C447C', border:'0.5px solid #B5D4F4', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 },
  erroBox:   { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14, lineHeight:1.5 },
  btnPrimary:{ width:'100%', padding:'11px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' },
  rodape:    { marginTop:12, fontSize:11, color:'#9ca3af', textAlign:'center', lineHeight:1.6 },
}
