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

const PLANOS = [
  {
    id: 'micro',
    nome: 'Micro',
    preco: 'R$ 49/mês',
    envios: 50,
    excedente: 'R$ 1,90/envio extra',
    cor: '#185FA5',
    bg: '#E6F1FB',
    destaque: false,
    items: [
      '50 envios/mês incluídos',
      'R$ 1,90 por envio excedente',
      'Importação por IA (PDF)',
      'ASO, LTCAT e PCMSO',
      'Transmissão eSocial SST',
      'Alertas de vencimento',
    ],
  },
  {
    id: 'starter',
    nome: 'Starter',
    preco: 'R$ 97/mês',
    envios: 100,
    excedente: 'R$ 1,50/envio extra',
    cor: '#27500A',
    bg: '#EAF3DE',
    destaque: true,
    items: [
      '100 envios/mês incluídos',
      'R$ 1,50 por envio excedente',
      'Tudo do Micro',
      'Multi-empresa (até 5 CNPJs)',
      'Convite de usuários',
      'Relatórios avançados',
    ],
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 'R$ 197/mês',
    envios: 400,
    excedente: 'R$ 1,20/envio extra',
    cor: '#633806',
    bg: '#FAEEDA',
    destaque: false,
    items: [
      '400 envios/mês incluídos',
      'R$ 1,20 por envio excedente',
      'Tudo do Starter',
      'Até 10 CNPJs',
      'Suporte prioritário',
      'Onboarding dedicado',
    ],
  },
]

export default function Planos() {
  const router = useRouter()
  const [planoAtual, setPlanoAtual] = useState<string>('trial')
  const [_empresaId, setEmpresaId] = useState('')
  const [trialRestante, setTrialRestante] = useState<number | null>(null)
  const [creditosRestantes, setCreditosRestantes] = useState<number | null>(null)
  const [creditosIncluidos, setCreditosIncluidos] = useState<number>(0)
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/login'); return }
    const empId = getEmpresaId() || user.empresa_id
    setEmpresaId(empId)
    const { data: emp } = await supabase
      .from('empresas')
      .select('plano, trial_ends_at, creditos_restantes, creditos_incluidos')
      .eq('id', empId).single()
    if (emp) {
      setPlanoAtual(emp.plano || 'trial')
      setCreditosRestantes(emp.creditos_restantes ?? null)
      setCreditosIncluidos(emp.creditos_incluidos ?? 0)
      if (emp.trial_ends_at) {
        const dias = Math.max(0, Math.ceil((new Date(emp.trial_ends_at).getTime() - Date.now()) / 86400000))
        setTrialRestante(dias)
      }
    }
    setCarregando(false)
  }

  async function assinar(planoId: string) {
    setErro('')
    setProcessando(planoId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ plano: planoId }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.erro || 'Erro ao criar sessão de pagamento')
      window.location.href = json.url
    } catch (err: any) {
      setErro(err.message)
      setProcessando(null)
    }
  }

  if (carregando) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' }}>
      Carregando...
    </div>
  )

  const pctCreditos = creditosIncluidos > 0 ? Math.min(100, Math.round((creditosRestantes ?? 0) / creditosIncluidos * 100)) : 0
  const corCreditos = pctCreditos > 40 ? '#27a048' : pctCreditos > 15 ? '#EF9F27' : '#dc2626'

  return (
    <Layout pagina="planos">
      <Head>
        <title>Planos e Preços — eSocial SST Transmissor</title>
        <meta name="description" content="Planos a partir de R$ 49/mês com envios incluídos. Transmita eventos SST (S-2220, S-2240, S-2221) com inteligência artificial." />
        <meta property="og:title" content="Planos e Preços — eSocial SST Transmissor" />
        <meta property="og:description" content="Transmita eventos SST ao eSocial com facilidade. Planos a partir de R$ 49/mês com trial gratuito de 14 dias." />
      </Head>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign:'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 6 }}>
            Escolha seu plano
          </div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>
            Mensalidade fixa + envios incluídos · Excedente cobrado automaticamente · Cancele quando quiser
          </div>

          {planoAtual === 'trial' && trialRestante !== null && trialRestante > 0 && (
            <div style={{ display:'inline-block', marginTop: 12, background:'#FAEEDA', border:'0.5px solid #FAC775', borderRadius: 8, padding:'8px 16px', fontSize:13, color:'#633806', fontWeight:500 }}>
              Seu trial termina em {trialRestante} dia{trialRestante !== 1 ? 's' : ''}
            </div>
          )}
          {(router.query.trial_expirado === '1' || (planoAtual === 'trial' && trialRestante === 0)) && (
            <div style={{ display:'inline-block', marginTop: 12, background:'#FCEBEB', border:'0.5px solid #F7C1C1', borderRadius: 8, padding:'8px 16px', fontSize:13, color:'#791F1F', fontWeight:600 }}>
              Seu trial de 14 dias expirou. Escolha um plano para continuar.
            </div>
          )}

          {/* Barra de créditos restantes (só para assinantes) */}
          {creditosRestantes !== null && !['trial','cancelado'].includes(planoAtual) && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginTop:14, background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:10, padding:'10px 16px' }}>
              <div>
                <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>Envios restantes este mês</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:120, height:6, background:'#e5e7eb', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ width:`${pctCreditos}%`, height:'100%', background: corCreditos, borderRadius:99, transition:'width .3s' }} />
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color: corCreditos }}>
                    {creditosRestantes}/{creditosIncluidos}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {router.query.upgrade === 'ok' && (
          <div style={{ background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:10, padding:'12px 16px', fontSize:13, marginBottom:20, textAlign:'center' }}>
            Plano ativado com sucesso! Obrigado por assinar.
          </div>
        )}

        {erro && (
          <div style={{ background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:10, padding:'12px 16px', fontSize:13, marginBottom:20 }}>
            {erro}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginBottom:32 }}>
          {PLANOS.map(p => {
            const atual = planoAtual === p.id
            return (
              <div key={p.id} style={{
                background: '#fff',
                border: `${p.destaque ? '2px' : '0.5px'} solid ${p.destaque ? p.cor : '#e5e7eb'}`,
                borderRadius: 14,
                overflow: 'hidden',
              }}>
                {p.destaque && (
                  <div style={{ background: p.cor, color:'#fff', fontSize:11, fontWeight:700, textAlign:'center', padding:'4px 0', letterSpacing:'0.05em' }}>
                    MAIS POPULAR
                  </div>
                )}
                <div style={{ padding:'20px 20px 24px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                    <div style={{ background: p.bg, borderRadius:8, padding:'6px 10px', fontSize:13, fontWeight:700, color: p.cor }}>
                      {p.nome}
                    </div>
                    {atual && (
                      <div style={{ background:'#f3f4f6', borderRadius:99, padding:'3px 10px', fontSize:11, color:'#6b7280', fontWeight:500 }}>
                        Plano atual
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize:26, fontWeight:700, color:'#111', marginBottom:2 }}>{p.preco}</div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginBottom:16 }}>{p.excedente}</div>

                  <ul style={{ listStyle:'none', padding:0, margin:'0 0 20px', display:'flex', flexDirection:'column', gap:6 }}>
                    {p.items.map((it, i) => (
                      <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, fontSize:12, color: i < 2 ? '#111' : '#374151', fontWeight: i < 2 ? 600 : 400 }}>
                        <span style={{ color: p.cor, flexShrink:0, fontWeight:700, marginTop:1 }}>✓</span>
                        {it}
                      </li>
                    ))}
                  </ul>

                  {atual ? (
                    <div style={{ width:'100%', padding:'10px', background:p.bg, border:`1px solid ${p.cor}40`, borderRadius:8, fontSize:13, fontWeight:600, color:p.cor, textAlign:'center' }}>
                      Plano ativo
                    </div>
                  ) : (
                    <button
                      onClick={() => assinar(p.id)}
                      disabled={!!processando}
                      style={{
                        width:'100%', padding:'10px', background: p.destaque ? p.cor : '#fff',
                        color: p.destaque ? '#fff' : p.cor,
                        border:`1.5px solid ${p.cor}`, borderRadius:8,
                        fontSize:13, fontWeight:600, cursor: processando ? 'not-allowed' : 'pointer',
                        opacity: processando && processando !== p.id ? 0.5 : 1,
                      }}>
                      {processando === p.id ? 'Redirecionando...' : 'Assinar agora'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'16px 20px', fontSize:12, color:'#6b7280', textAlign:'center' }}>
          Pagamentos processados com segurança pelo <strong>Stripe</strong> · Cartão de crédito, débito ou boleto ·
          Envios excedentes cobrados no fechamento do ciclo mensal · Cancele a qualquer momento
        </div>
      </div>
    </Layout>
  )
}
