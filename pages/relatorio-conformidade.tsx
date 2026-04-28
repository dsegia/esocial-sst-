import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { getEmpresaId } from '../lib/empresa'
import { pdfConformidadeASO } from '../lib/gerarPDF'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

type Funcionario = {
  id: string
  nome: string
  cpf: string
  funcao: string | null
  setor: string | null
  ultimoAso: {
    data_exame: string
    prox_exame: string | null
    conclusao: string | null
    tipo_aso: string | null
  } | null
  diasRestantes: number | null
  statusLabel: string
  statusCor: string
  statusBg: string
}

type Filtro = 'todos' | 'em_dia' | 'atencao' | 'vencido' | 'sem_aso'

export default function RelatorioConformidade() {
  const router = useRouter()
  const [empresa, setEmpresa]       = useState<any>(null)
  const [funcs, setFuncs]           = useState<Funcionario[]>([])
  const [filtro, setFiltro]         = useState<Filtro>('todos')
  const [busca, setBusca]           = useState('')
  const [carregando, setCarregando] = useState(true)
  const [kpis, setKpis]             = useState<any>(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: user } = await supabase
      .from('usuarios')
      .select('empresa_id, empresas(razao_social, cnpj)')
      .eq('id', session.user.id).single()
    if (!user) { router.push('/login'); return }
    const empId = getEmpresaId() || user.empresa_id
    setEmpresa(user.empresas)
    await carregar(empId)
    setCarregando(false)
  }

  async function carregar(empresaId: string) {
    const hoje = new Date()

    const [funcsRes, asosRes] = await Promise.all([
      supabase.from('funcionarios')
        .select('id, nome, cpf, funcao, setor')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('nome'),
      supabase.from('asos')
        .select('id, funcionario_id, tipo_aso, data_exame, prox_exame, conclusao')
        .eq('empresa_id', empresaId)
        .order('data_exame', { ascending: false }),
    ])

    const funcionarios = funcsRes.data || []
    const asos         = asosRes.data || []

    // Último ASO por funcionário
    const ultimoAsoPor: Record<string, any> = {}
    asos.forEach((a: any) => {
      if (!ultimoAsoPor[a.funcionario_id]) ultimoAsoPor[a.funcionario_id] = a
    })

    const lista: Funcionario[] = funcionarios.map((f: any) => {
      const aso = ultimoAsoPor[f.id] || null
      let statusLabel = 'Sem ASO'
      let statusCor   = '#791F1F'
      let statusBg    = '#FCEBEB'
      let diasRestantes: number | null = null

      if (aso?.prox_exame) {
        const dias = Math.ceil((new Date(aso.prox_exame).getTime() - hoje.getTime()) / 86400000)
        diasRestantes = dias
        if (dias < 0) {
          statusLabel = 'Vencido'
          statusCor   = '#791F1F'
          statusBg    = '#FCEBEB'
        } else if (dias <= 30) {
          statusLabel = 'Atenção'
          statusCor   = '#633806'
          statusBg    = '#FAEEDA'
        } else {
          statusLabel = 'Em dia'
          statusCor   = '#27500A'
          statusBg    = '#EAF3DE'
        }
      }

      return { id: f.id, nome: f.nome, cpf: f.cpf, funcao: f.funcao, setor: f.setor, ultimoAso: aso, diasRestantes, statusLabel, statusCor, statusBg }
    })

    // KPIs
    const emDia   = lista.filter(f => f.statusLabel === 'Em dia').length
    const atencao = lista.filter(f => f.statusLabel === 'Atenção').length
    const vencido = lista.filter(f => f.statusLabel === 'Vencido').length
    const semAso  = lista.filter(f => f.statusLabel === 'Sem ASO').length
    const total   = lista.length
    const conf    = total > 0 ? Math.round((emDia / total) * 100) : 100

    setFuncs(lista)
    setKpis({ total, emDia, atencao, vencido, semAso, conf })
  }

  function gerarPDF() {
    if (!empresa) return
    const dados = listaFiltrada.map(f => ({
      nome: f.nome,
      cpf: f.cpf,
      funcao: f.funcao,
      setor: f.setor,
      ultimoAso: f.ultimoAso
        ? { data_exame: f.ultimoAso.data_exame, prox_exame: f.ultimoAso.prox_exame || '', conclusao: f.ultimoAso.conclusao || '' }
        : null,
    }))
    pdfConformidadeASO(empresa.razao_social, empresa.cnpj, dados)
  }

  const listaFiltrada = funcs
    .filter(f => {
      if (filtro === 'em_dia')  return f.statusLabel === 'Em dia'
      if (filtro === 'atencao') return f.statusLabel === 'Atenção'
      if (filtro === 'vencido') return f.statusLabel === 'Vencido'
      if (filtro === 'sem_aso') return f.statusLabel === 'Sem ASO'
      return true
    })
    .filter(f => {
      if (!busca) return true
      const q = busca.toLowerCase()
      return f.nome.toLowerCase().includes(q) ||
             (f.cpf || '').includes(q) ||
             (f.funcao || '').toLowerCase().includes(q) ||
             (f.setor || '').toLowerCase().includes(q)
    })

  if (carregando) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #185FA5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const FILTROS: Array<{ key: Filtro; label: string; cor: string; bg: string; count: number }> = [
    { key: 'todos',   label: 'Todos',    cor: '#374151', bg: '#f3f4f6', count: kpis.total   },
    { key: 'em_dia',  label: '✅ Em dia', cor: '#27500A', bg: '#EAF3DE', count: kpis.emDia   },
    { key: 'atencao', label: '⏰ Atenção',cor: '#633806', bg: '#FAEEDA', count: kpis.atencao },
    { key: 'vencido', label: '🚨 Vencido',cor: '#791F1F', bg: '#FCEBEB', count: kpis.vencido },
    { key: 'sem_aso', label: '🩺 Sem ASO',cor: '#791F1F', bg: '#FCEBEB', count: kpis.semAso  },
  ]

  return (
    <Layout pagina="relatorio-conformidade">
      <Head><title>Relatório de Conformidade — eSocial SST</title></Head>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>📋 Relatório de Conformidade</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
            {empresa?.razao_social} · ASOs por funcionário
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btnOutline} onClick={() => router.push('/analytics')}>← Analytics</button>
          <button
            style={{ padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            onClick={gerarPDF}>
            🖨 Exportar PDF
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Total', val: kpis.total,   cor: '#185FA5', bg: '#f9fafb', sub: 'funcionários ativos' },
          { label: 'Em dia', val: kpis.emDia,  cor: '#27500A', bg: '#EAF3DE', sub: 'ASO válido' },
          { label: 'Atenção', val: kpis.atencao,cor: '#633806', bg: '#FAEEDA', sub: 'vence em 30d' },
          { label: 'Vencido', val: kpis.vencido,cor: '#791F1F', bg: '#FCEBEB', sub: 'fora do prazo' },
          { label: 'Sem ASO', val: kpis.semAso, cor: '#791F1F', bg: '#FCEBEB', sub: 'sem registro' },
        ].map((k, i) => (
          <div key={i} style={{ background: k.bg, border: `0.5px solid ${k.cor}33`, borderRadius: 12, padding: '0.875rem 1rem' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.cor }}>{k.val}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111', marginTop: 2 }}>{k.label}</div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Barra de conformidade */}
      <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Índice de conformidade geral</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: kpis.conf >= 80 ? '#1D9E75' : kpis.conf >= 50 ? '#EF9F27' : '#E24B4A' }}>
            {kpis.conf}%
          </div>
        </div>
        <div style={{ height: 8, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: kpis.conf >= 80 ? '#1D9E75' : kpis.conf >= 50 ? '#EF9F27' : '#E24B4A', borderRadius: 99, width: `${kpis.conf}%`, transition: 'width .6s' }} />
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
          {kpis.emDia} de {kpis.total} funcionários com ASO em dia
          {kpis.conf < 80 && <span style={{ color: '#E24B4A', marginLeft: 8, fontWeight: 500 }}>— abaixo do recomendado (80%)</span>}
        </div>
      </div>

      {/* Filtros + Busca */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTROS.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              style={{ padding: '5px 12px', fontSize: 11, fontWeight: filtro === f.key ? 600 : 400, borderRadius: 7, cursor: 'pointer', border: filtro === f.key ? `1.5px solid ${f.cor}` : '1px solid #e5e7eb', background: filtro === f.key ? f.bg : '#fff', color: filtro === f.key ? f.cor : '#6b7280' }}>
              {f.label} <span style={{ opacity: 0.7 }}>({f.count})</span>
            </button>
          ))}
        </div>
        <input
          placeholder="Buscar por nome, CPF ou função..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ padding: '7px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, width: 260, background: '#fff', color: '#111', fontFamily: 'inherit' }}
        />
      </div>

      {/* Tabela */}
      <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {listaFiltrada.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
            <div>Nenhum funcionário encontrado com os filtros atuais.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Funcionário', 'CPF', 'Função', 'Setor', 'Tipo ASO', 'Último ASO', 'Próx. ASO', 'Dias restantes', 'Status'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap', borderBottom: '0.5px solid #f3f4f6' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((f, i) => {
                const aso = f.ultimoAso
                const dataExame = aso?.data_exame
                  ? new Date(aso.data_exame + 'T12:00:00').toLocaleDateString('pt-BR')
                  : '—'
                const proxExame = aso?.prox_exame
                  ? new Date(aso.prox_exame + 'T12:00:00').toLocaleDateString('pt-BR')
                  : '—'
                let diasTxt = '—'
                if (f.diasRestantes !== null) {
                  diasTxt = f.diasRestantes < 0
                    ? `${Math.abs(f.diasRestantes)}d vencido`
                    : `${f.diasRestantes}d`
                }

                return (
                  <tr key={f.id} style={{ borderBottom: '0.5px solid #f9fafb' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111', whiteSpace: 'nowrap' }}>
                      {f.nome.split(' ').slice(0, 3).join(' ')}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#6b7280', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {f.cpf || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{f.funcao || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{f.setor || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 11 }}>
                      {aso?.tipo_aso || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{dataExame}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{proxExame}</td>
                    <td style={{ padding: '10px 12px', color: f.diasRestantes !== null && f.diasRestantes < 0 ? '#E24B4A' : f.diasRestantes !== null && f.diasRestantes <= 30 ? '#EF9F27' : '#374151', fontWeight: f.diasRestantes !== null && f.diasRestantes <= 30 ? 600 : 400, whiteSpace: 'nowrap' }}>
                      {diasTxt}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: f.statusBg, color: f.statusCor, whiteSpace: 'nowrap' }}>
                        {f.statusLabel}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div style={{ padding: '10px 14px', borderTop: '0.5px solid #f3f4f6', fontSize: 11, color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
          <span>{listaFiltrada.length} funcionário(s) exibido(s)</span>
          <span>Gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>
    </Layout>
  )
}

const s = {
  btnOutline: { padding: '8px 14px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#374151' } as React.CSSProperties,
}
