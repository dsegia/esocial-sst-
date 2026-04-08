import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const MENU = [
  { href:'/dashboard',    label:'Dashboard',             icon:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { href:'/funcionarios', label:'Funcionários',           icon:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z' },
  { href:'/leitor',       label:'Leitor PDF/XML',         icon:'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12' },
  { sep: true, label: 'DOCUMENTOS SST' },
  { href:'/ltcat',        label:'LTCAT',                  icon:'M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2zM14 3v5h5' },
  { href:'/pcmso',        label:'PCMSO',                  icon:'M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2zM14 3v5h5' },
  { sep: true, label: 'TRANSMISSÕES' },
  { href:'/s2220',        label:'S-2220 Monit. Saúde',    icon:'M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2zM14 3v5h5' },
  { href:'/s2240',        label:'S-2240 Cond. Ambientais',icon:'M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2zM14 3v5h5' },
  { href:'/s2210',        label:'S-2210 CAT',             icon:'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01' },
  { sep: true, label: 'GESTÃO' },
  { href:'/historico',    label:'Histórico',              icon:'M22 12h-4l-3 9L9 3l-3 9H2' },
  { href:'/alertas',      label:'Alertas',                icon:'M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zM12 6v6l4 2' },
]

export default function Layout({ children, pagina }) {
  const router = useRouter()
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [nomeUser, setNomeUser] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase.from('usuarios').select('nome, empresas(razao_social)').eq('id', session.user.id).single()
        .then(({ data }) => {
          if (data) { setNomeUser(data.nome); setNomeEmpresa(data.empresas?.razao_social || '') }
        })
    })
  }, [])

  async function sair() { await supabase.auth.signOut(); router.push('/') }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f6f9', fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ width:230, flexShrink:0, background:'#fff', borderRight:'0.5px solid #e5e7eb', display:'flex', flexDirection:'column', padding:'1.25rem 0' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 1.25rem 1.25rem', borderBottom:'0.5px solid #e5e7eb', marginBottom:'1rem' }}>
          <div style={{ width:36, height:36, background:'#185FA5', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="14,3 14,8 19,8"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>eSocial SST</div>
            <div style={{ fontSize:10, color:'#6b7280' }}>Transmissor v1.0</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'0 .75rem', overflowY:'auto' }}>
          {MENU.map((item, i) => {
            if (item.sep) return (
              <div key={i} style={{ fontSize:9, fontWeight:700, color:'#c4c4c0', textTransform:'uppercase', letterSpacing:'.08em', padding:'10px 10px 4px', marginTop:4 }}>
                {item.label}
              </div>
            )
            const ativo = pagina === item.href.replace('/','')
            return (
              <a key={item.href} href={item.href} style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'7px 10px', borderRadius:8, marginBottom:1,
                fontSize:12, textDecoration:'none',
                background: ativo ? '#E6F1FB' : 'transparent',
                color: ativo ? '#185FA5' : '#374151',
                fontWeight: ativo ? 500 : 400,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={ativo ? '#185FA5' : '#9ca3af'} strokeWidth="2" style={{ flexShrink:0 }}>
                  <path d={item.icon}/>
                </svg>
                <span style={{ lineHeight:1.3 }}>{item.label}</span>
              </a>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding:'1rem 1.25rem 0', borderTop:'0.5px solid #e5e7eb', marginTop:'1rem' }}>
          <div style={{ fontSize:12, fontWeight:500, color:'#374151', marginBottom:1 }}>{nomeUser}</div>
          <div style={{ fontSize:11, color:'#6b7280', marginBottom:10 }}>{nomeEmpresa}</div>
          <button onClick={sair} style={{ width:'100%', padding:'7px', background:'transparent', border:'0.5px solid #d1d5db', borderRadius:8, fontSize:12, color:'#6b7280', cursor:'pointer' }}>
            Sair
          </button>
        </div>
      </div>

      <div style={{ flex:1, padding:'1.5rem', overflowY:'auto' }}>
        {children}
      </div>
    </div>
  )
}
