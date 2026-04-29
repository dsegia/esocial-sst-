import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { getEmpresaId, isMultiEmpresa, limparEmpresa } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MENU = [
  { href:'/dashboard',       label:'Dashboard',               icon:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { href:'/funcionarios',    label:'Funcionários',             icon:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z' },
  { sep:true, label:'DOCUMENTOS SST' },
  { href:'/importar',        label:'Importar PDF',            icon:'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
  { href:'/aso',             label:'ASO',                     icon:'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { href:'/ltcat',           label:'LTCAT',                   icon:'M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2zM14 3v5h5' },
  { href:'/pcmso',           label:'PCMSO',                   icon:'M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2zM14 3v5h5' },
  { sep:true, label:'TRANSMISSÕES' },
  { href:'/s2220',           label:'S-2220 Monit. Saúde',     icon:'M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2zM14 3v5h5' },
  { href:'/s2240',           label:'S-2240 Cond. Ambientais', icon:'M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2zM14 3v5h5' },
  { href:'/s2210',           label:'S-2210 CAT',              icon:'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01' },
  { href:'/s2221',            label:'S-2221 Toxicológico',      icon:'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01' },
  { href:'/fila-transmissao', label:'Fila de Transmissão',    icon:'M4 6h16M4 10h16M4 14h8m-8 4h4' },
  { sep:true, label:'GESTÃO' },
  { href:'/relatorios',       label:'Relatórios',             icon:'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href:'/relatorio-conformidade', label:'Conformidade',     icon:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href:'/alertas',          label:'Alertas',                icon:'M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zM12 6v6l4 2' },
  { href:'/planos',          label:'Planos',                  icon:'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { href:'/configuracoes',   label:'Configurações',           icon:'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z' },
  { href:'/conta',           label:'Minha Conta',             icon:'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z' },
]

export default function Layout({ children, pagina }: { children: ReactNode; pagina: string }) {
  const router = useRouter()
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [nomeUser, setNomeUser] = useState('')
  const [semCert, setSemCert] = useState(false)
  const [multi, setMulti] = useState(false)
  const [plano, setPlano] = useState<string>('trial')
  const [trialDias, setTrialDias] = useState<number>(14)
  const [creditos, setCreditos] = useState<{ restantes: number; incluidos: number } | null>(null)

  const PAGES_SEM_BLOQUEIO = ['/planos', '/conta', '/login', '/cadastro', '/aceitar-convite', '/']

  useEffect(() => {
    setMulti(isMultiEmpresa())
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase.from('usuarios').select('nome, empresa_id').eq('id', session.user.id).single()
        .then(({ data: usuario }) => {
          if (!usuario) return
          setNomeUser(usuario.nome)
          const eId = getEmpresaId() || usuario.empresa_id
          supabase.from('empresas').select('razao_social, cert_digital_validade, plano, trial_inicio, creditos_restantes, creditos_incluidos')
            .eq('id', eId).single()
            .then(({ data: emp }) => {
              if (emp) {
                setNomeEmpresa(emp.razao_social || '')
                setSemCert(!emp.cert_digital_validade)
                const planoAtual = emp.plano || 'trial'
                setPlano(planoAtual)
                if (emp.creditos_restantes != null) {
                  setCreditos({ restantes: emp.creditos_restantes, incluidos: emp.creditos_incluidos ?? 0 })
                }

                if (planoAtual === 'trial' && emp.trial_inicio) {
                  const dias = Math.max(0, 14 - Math.ceil((Date.now() - new Date(emp.trial_inicio).getTime()) / 86400000))
                  setTrialDias(dias)

                  // Redireciona para planos se trial expirou
                  const paginaAtual = window.location.pathname
                  if (dias === 0 && !PAGES_SEM_BLOQUEIO.some(p => paginaAtual.startsWith(p))) {
                    router.push('/planos?trial_expirado=1')
                  }
                }

                // Redireciona se assinatura cancelada
                if (planoAtual === 'cancelado') {
                  const paginaAtual = window.location.pathname
                  if (!PAGES_SEM_BLOQUEIO.some(p => paginaAtual.startsWith(p))) {
                    router.push('/planos?cancelado=1')
                  }
                }
              }
            })
        })
    })
  }, [])

  async function sair() { limparEmpresa(); await supabase.auth.signOut(); router.push('/') }

  function initials(nome: string) {
    return nome.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase()
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f6f9', fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ width:230, flexShrink:0, background:'#fff', borderRight:'0.5px solid #e5e7eb', display:'flex', flexDirection:'column', padding:'1.25rem 0' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 1.25rem .75rem' }}>
          <div style={{ width:32, height:32, background:'#185FA5', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="14,3 14,8 19,8"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:'#111' }}>eSocial SST</div>
            <div style={{ fontSize:10, color:'#9ca3af' }}>Transmissor v1.0</div>
          </div>
        </div>

        {/* Empresa atual — clique abre /empresas */}
        <div style={{ padding:'0 .75rem', marginBottom:'.75rem' }}>
          <button onClick={() => router.push('/empresas')}
            style={{
              width:'100%', display:'flex', alignItems:'center', gap:8,
              padding:'8px 10px', borderRadius:8, border:'0.5px solid #e5e7eb',
              background: pagina === 'empresas' ? '#E6F1FB' : '#f9fafb',
              cursor:'pointer', textAlign:'left',
            }}>
            <div style={{ width:28, height:28, borderRadius:6, background:'#185FA5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ fontSize:9, fontWeight:700, color:'#fff', lineHeight:1 }}>
                {initials(nomeEmpresa || 'E')}
              </span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:600, color: pagina === 'empresas' ? '#185FA5' : '#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {nomeEmpresa || 'Carregando...'}
              </div>
              <div style={{ fontSize:10, color:'#9ca3af', marginTop:1 }}>
                {multi ? 'Gerenciar empresas' : 'Ver empresa'}
              </div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ flexShrink:0 }}>
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </button>
        </div>

        {/* Menu de navegação */}
        <nav style={{ flex:1, padding:'0 .75rem', overflowY:'auto' }}>
          {MENU.map((item: any, i) => {
            if (item.sep) return (
              <div key={i} style={{ fontSize:9, fontWeight:700, color:'#c4c4c0', textTransform:'uppercase', letterSpacing:'.08em', padding:'10px 10px 4px', marginTop:4 }}>
                {item.label}
              </div>
            )
            const ativo = pagina === item.href.replace('/','').split('?')[0]
            const isCfg = item.href === '/configuracoes'
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
                {isCfg && semCert && (
                  <span style={{ marginLeft:'auto', width:7, height:7, borderRadius:'50%', background:'#EF9F27', flexShrink:0 }}></span>
                )}
              </a>
            )
          })}
        </nav>

        {/* Saldo de envios (assinantes ativos) */}
        {creditos && !['trial','cancelado'].includes(plano) && (
          <div style={{ padding:'0 .75rem', marginBottom:'.5rem' }}>
            <a href="/planos" style={{ display:'block', padding:'8px 10px', borderRadius:8, background:'#f9fafb', border:'0.5px solid #e5e7eb', textDecoration:'none' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <span style={{ fontSize:10, color:'#6b7280' }}>Envios este mês</span>
                <span style={{ fontSize:11, fontWeight:700, color: creditos.restantes === 0 ? '#dc2626' : creditos.restantes <= Math.round(creditos.incluidos * 0.15) ? '#EF9F27' : '#27a048' }}>
                  {creditos.restantes}/{creditos.incluidos}
                </span>
              </div>
              <div style={{ height:4, background:'#e5e7eb', borderRadius:99, overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:99,
                  width: creditos.incluidos > 0 ? `${Math.min(100, Math.round(creditos.restantes / creditos.incluidos * 100))}%` : '0%',
                  background: creditos.restantes === 0 ? '#dc2626' : creditos.restantes <= Math.round(creditos.incluidos * 0.15) ? '#EF9F27' : '#27a048',
                  transition:'width .3s',
                }} />
              </div>
            </a>
          </div>
        )}

        {/* Banner trial / upgrade */}
        {(plano === 'trial' || plano === 'cancelado') && (
          <div style={{ padding:'0 .75rem', marginBottom:'.5rem' }}>
            <button onClick={() => router.push('/conta')} style={{
              width:'100%', padding:'9px 10px', borderRadius:8, border:'none', cursor:'pointer',
              background: plano === 'cancelado' ? '#FCEBEB' : trialDias <= 3 ? '#FFF0E6' : '#E6F1FB',
              textAlign:'left', display:'flex', alignItems:'center', gap:8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={plano === 'cancelado' ? '#ef4444' : trialDias <= 3 ? '#d97706' : '#185FA5'} strokeWidth="2">
                <path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zM12 8v4M12 16h.01"/>
              </svg>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color: plano === 'cancelado' ? '#ef4444' : trialDias <= 3 ? '#d97706' : '#185FA5' }}>
                  {plano === 'cancelado' ? 'Assinatura cancelada' : `Trial: ${trialDias}d restantes`}
                </div>
                <div style={{ fontSize:10, color:'#6b7280' }}>Clique para ver planos</div>
              </div>
            </button>
          </div>
        )}

        {/* Link de onboarding */}
        <div style={{ padding:'0 .75rem .5rem' }}>
          <a href="/onboarding" style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 10px', borderRadius:8, fontSize:11, color:'#9ca3af', textDecoration:'none', background:'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background='#f9fafb')}
            onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            Primeiros passos
          </a>
        </div>

        {/* Rodapé: usuário + sair */}
        <div style={{ padding:'.75rem 1.25rem 0', borderTop:'0.5px solid #e5e7eb', marginTop:'auto', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:500, color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nomeUser}</div>
            <div style={{ fontSize:10, color:'#9ca3af' }}>Usuário</div>
          </div>
          <button onClick={sair} title="Sair"
            style={{ background:'transparent', border:'0.5px solid #e5e7eb', borderRadius:7, padding:'5px 8px', cursor:'pointer', fontSize:11, color:'#9ca3af', flexShrink:0 }}>
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
