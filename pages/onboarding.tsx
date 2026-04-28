import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import { getEmpresaId } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

type Passo = {
  titulo: string
  descricao: string
  icon: string
  rota: string
  rotaLabel: string
  feito: boolean
  obrigatorio: boolean
}

export default function Onboarding() {
  const router = useRouter()
  const [carregando, setCarregando] = useState(true)
  const [passos, setPassos]         = useState<Passo[]>([])
  const [nomeUser, setNomeUser]     = useState('')
  const [empresaNome, setEmpresaNome] = useState('')
  const [progresso, setProgresso]   = useState(0)
  const [concluido, setConcluido]   = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: user } = await supabase
      .from('usuarios')
      .select('nome, empresa_id, empresas(razao_social, cnpj, cert_digital_validade)')
      .eq('id', session.user.id).single()
    if (!user) { router.push('/login'); return }

    setNomeUser((user.nome || '').split(' ')[0])
    setEmpresaNome((user.empresas as any)?.razao_social || '')

    const empId = getEmpresaId() || user.empresa_id
    const emp   = user.empresas as any

    // Verificar conclusão de cada passo em paralelo
    const [funcsRes, asosRes, txRes] = await Promise.all([
      supabase.from('funcionarios').select('id').eq('empresa_id', empId).eq('ativo', true).limit(1),
      supabase.from('asos').select('id').eq('empresa_id', empId).limit(1),
      supabase.from('transmissoes').select('id').eq('empresa_id', empId).eq('status', 'enviado').limit(1),
    ])

    const temCert     = !!(emp?.cnpj && emp?.cert_digital_validade)
    const temFunc     = (funcsRes.data?.length || 0) > 0
    const temAso      = (asosRes.data?.length || 0) > 0
    const temTx       = (txRes.data?.length || 0) > 0

    const lista: Passo[] = [
      {
        titulo: 'Cadastrar empresa',
        descricao: 'CNPJ, razão social e dados básicos da empresa.',
        icon: '🏢',
        rota: '/configuracoes',
        rotaLabel: 'Ir para Configurações',
        feito: !!(emp?.cnpj),
        obrigatorio: true,
      },
      {
        titulo: 'Configurar certificado digital',
        descricao: 'O certificado A1 (.pfx) é necessário para assinar e transmitir eventos eSocial ao Gov.br.',
        icon: '🔐',
        rota: '/configuracoes',
        rotaLabel: 'Configurar certificado',
        feito: temCert,
        obrigatorio: true,
      },
      {
        titulo: 'Adicionar funcionários',
        descricao: 'Cadastre ao menos um funcionário ativo para poder registrar ASOs e transmitir eventos.',
        icon: '👥',
        rota: '/funcionarios',
        rotaLabel: 'Gerenciar funcionários',
        feito: temFunc,
        obrigatorio: true,
      },
      {
        titulo: 'Importar ou cadastrar ASO',
        descricao: 'O ASO (Atestado de Saúde Ocupacional) é a base do evento S-2220. Importe via PDF ou cadastre manualmente.',
        icon: '🩺',
        rota: '/importar',
        rotaLabel: 'Importar documento',
        feito: temAso,
        obrigatorio: true,
      },
      {
        titulo: 'Realizar primeira transmissão',
        descricao: 'Transmita seu primeiro evento S-2220 (Monitoramento de Saúde) ao Gov.br com certificado digital.',
        icon: '📡',
        rota: '/transmissao-manual',
        rotaLabel: 'Transmitir evento',
        feito: temTx,
        obrigatorio: true,
      },
    ]

    const feitos = lista.filter(p => p.feito).length
    const pct    = Math.round((feitos / lista.length) * 100)

    setPassos(lista)
    setProgresso(pct)
    setConcluido(pct === 100)
    setCarregando(false)
  }

  if (carregando) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f4f6f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #185FA5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const proxPasso = passos.find(p => !p.feito)

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '3rem 1rem' }}>
      <Head><title>Primeiros passos — eSocial SST</title></Head>

      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '2rem' }}>
          <div style={{ width: 36, height: 36, background: '#185FA5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="14,3 14,8 19,8"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>eSocial SST</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Transmissor v1.0</div>
          </div>
          <button onClick={() => router.push('/dashboard')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ca3af' }}>
            Ir ao painel →
          </button>
        </div>

        {/* Header */}
        {concluido ? (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 6 }}>
              Configuração concluída!
            </div>
            <div style={{ fontSize: 14, color: '#6b7280' }}>
              {empresaNome} está pronta para transmitir eventos eSocial SST ao Gov.br.
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              style={{ marginTop: 24, padding: '12px 28px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Acessar o painel →
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 4 }}>
              Olá, {nomeUser}! 👋
            </div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              Siga os passos abaixo para configurar o <strong>{empresaNome}</strong> e começar a transmitir eventos eSocial.
            </div>

            {/* Barra de progresso */}
            <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Progresso da configuração</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: progresso >= 80 ? '#1D9E75' : '#185FA5' }}>{progresso}%</div>
              </div>
              <div style={{ height: 7, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: progresso >= 80 ? '#1D9E75' : '#185FA5', borderRadius: 99, width: `${progresso}%`, transition: 'width .6s ease' }} />
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                {passos.filter(p => p.feito).length} de {passos.length} etapas concluídas
              </div>
            </div>
          </div>
        )}

        {/* Lista de passos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {passos.map((passo, i) => {
            const isProx = proxPasso === passo
            return (
              <div key={i} style={{
                background: '#fff',
                border: `0.5px solid ${passo.feito ? '#C0DD97' : isProx ? '#185FA5' : '#e5e7eb'}`,
                borderRadius: 12,
                padding: '16px 18px',
                opacity: passo.feito || isProx || !proxPasso ? 1 : 0.6,
                transition: 'all .2s',
              }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

                  {/* Ícone de status */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: passo.feito ? '#EAF3DE' : isProx ? '#E6F1FB' : '#f3f4f6',
                    border: `1.5px solid ${passo.feito ? '#C0DD97' : isProx ? '#185FA5' : '#e5e7eb'}`,
                    fontSize: 18,
                  }}>
                    {passo.feito ? '✅' : passo.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: passo.feito ? '#27500A' : '#111' }}>
                        {i + 1}. {passo.titulo}
                      </div>
                      {passo.feito ? (
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: '#EAF3DE', color: '#27500A' }}>
                          Concluído ✓
                        </span>
                      ) : isProx ? (
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: '#E6F1FB', color: '#185FA5' }}>
                          Próximo passo
                        </span>
                      ) : null}
                    </div>

                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginBottom: passo.feito ? 0 : 12 }}>
                      {passo.descricao}
                    </div>

                    {!passo.feito && (
                      <button
                        onClick={() => router.push(passo.rota)}
                        style={{
                          padding: '7px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', borderRadius: 7,
                          border: isProx ? 'none' : '1px solid #d1d5db',
                          background: isProx ? '#185FA5' : '#fff',
                          color: isProx ? '#fff' : '#374151',
                          transition: 'opacity .15s',
                        }}>
                        {passo.rotaLabel} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Ajuda */}
        <div style={{ marginTop: 24, padding: '14px 18px', background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>💬</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 3 }}>Precisa de ajuda?</div>
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
              Consulte a documentação ou entre em contato pelo suporte. Para configurar o certificado digital A1, você precisará do arquivo <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>.pfx</code> e a senha fornecidos pela certificadora.
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#d1d5db' }}>
          eSocial SST Transmissor · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
