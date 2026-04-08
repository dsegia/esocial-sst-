import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Exames padrão por tipo de risco (baseado na NR-7)
const EXAMES_POR_RISCO = {
  fis: ['Audiometria tonal', 'Espirometria', 'Acuidade visual'],
  qui: ['Hemograma completo', 'Avaliação clínica', 'Espirometria'],
  bio: ['Hemograma completo', 'Avaliação clínica', 'Sorologia hepatite B'],
  erg: ['Avaliação clínica', 'Avaliação psicossocial', 'Rx coluna'],
}

export default function PCMSO() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [funcionarios, setFuncionarios] = useState([])
  const [ltcatAtivo, setLtcatAtivo] = useState(null)
  const [asos, setAsos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [funcSel, setFuncSel] = useState(null)
  const [filtroSetor, setFiltroSetor] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresaId(user.empresa_id)

    const [funcsRes, ltcatRes, asosRes] = await Promise.all([
      supabase.from('funcionarios').select('id, nome, cpf, funcao, setor, matricula_esocial').eq('empresa_id', user.empresa_id).eq('ativo', true).order('nome'),
      supabase.from('ltcats').select('*').eq('empresa_id', user.empresa_id).eq('ativo', true).order('data_emissao', { ascending: false }).limit(1).single(),
      supabase.from('asos').select('funcionario_id, tipo_aso, data_exame, prox_exame, conclusao, exames').eq('empresa_id', user.empresa_id).order('data_exame', { ascending: false }),
    ])

    setFuncionarios(funcsRes.data || [])
    setLtcatAtivo(ltcatRes.data || null)
    setAsos(asosRes.data || [])
    setCarregando(false)
  }

  function ultimoAso(funcId) {
    return asos.filter(a => a.funcionario_id === funcId)[0] || null
  }

  function statusAso(aso) {
    if (!aso) return { label:'Sem ASO', cor:'#E24B4A', bg:'#FCEBEB' }
    const dias = Math.round((new Date(aso.prox_exame) - new Date()) / 86400000)
    if (!aso.prox_exame || dias < 0) return { label:'Vencido', cor:'#E24B4A', bg:'#FCEBEB' }
    if (dias <= 30) return { label:`Vence em ${dias}d`, cor:'#EF9F27', bg:'#FAEEDA' }
    if (dias <= 60) return { label:`Vence em ${dias}d`, cor:'#EF9F27', bg:'#FAEEDA' }
    return { label:'Em dia', cor:'#1D9E75', bg:'#EAF3DE' }
  }

  function agentesDoFuncionario(func) {
    if (!ltcatAtivo?.ghes) return []
    for (const ghe of ltcatAtivo.ghes) {
      if (ghe.setor && func.setor && ghe.setor.toLowerCase().includes(func.setor.toLowerCase())) {
        return ghe.agentes || []
      }
    }
    return []
  }

  function examesRecomendados(agentes) {
    const set = new Set(['Avaliação clínica'])
    agentes.forEach(ag => (EXAMES_POR_RISCO[ag.tipo] || []).forEach(e => set.add(e)))
    return [...set]
  }

  const setores = [...new Set(funcionarios.map(f => f.setor).filter(Boolean))]
  const funcsFiltradas = filtroSetor ? funcionarios.filter(f => f.setor === filtroSetor) : funcionarios

  const totalEmDia = funcionarios.filter(f => {
    const st = statusAso(ultimoAso(f.id))
    return st.label === 'Em dia'
  }).length

  const conformidade = funcionarios.length > 0 ? Math.round((totalEmDia / funcionarios.length) * 100) : 100

  if (carregando) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' }}>Carregando...</div>

  return (
    <Layout pagina="pcmso">
      <Head><title>PCMSO — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>PCMSO</div>
          <div style={s.sub}>Programa de Controle Médico de Saúde Ocupacional · NR-7</div>
        </div>
        <button style={s.btnPrimary} onClick={() => router.push('/leitor')}>
          + Importar PDF
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:'1.25rem' }}>
        {[
          { n: funcionarios.length, l:'Funcionários ativos', c:'#185FA5' },
          { n: conformidade + '%',  l:'ASOs em dia',         c:'#1D9E75' },
          { n: funcionarios.filter(f => !ultimoAso(f.id)).length, l:'Sem ASO', c:'#E24B4A' },
          { n: ltcatAtivo ? 'Vigente' : 'Ausente', l:'LTCAT', c: ltcatAtivo?'#1D9E75':'#E24B4A' },
        ].map((k,i) => (
          <div key={i} style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1rem' }}>
            <div style={{ fontSize:22, fontWeight:700, color:k.c, marginBottom:4 }}>{k.n}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>{k.l}</div>
          </div>
        ))}
      </div>

      {!ltcatAtivo && (
        <div style={{ background:'#FAEEDA', border:'1px solid #EF9F27', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#633806', marginBottom:14 }}>
          ⚠ <strong>LTCAT não encontrado.</strong> Os exames recomendados por função dependem dos agentes de risco do LTCAT.
          <a href="/ltcat" style={{ marginLeft:8, color:'#633806', fontWeight:600 }}>Cadastrar LTCAT →</a>
        </div>
      )}

      {/* Filtro por setor */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <button onClick={() => setFiltroSetor('')} style={{ ...s.filtroBtn, background: !filtroSetor?'#185FA5':'#f3f4f6', color: !filtroSetor?'#fff':'#374151' }}>
          Todos ({funcionarios.length})
        </button>
        {setores.map(st => (
          <button key={st} onClick={() => setFiltroSetor(st)} style={{ ...s.filtroBtn, background: filtroSetor===st?'#185FA5':'#f3f4f6', color: filtroSetor===st?'#fff':'#374151' }}>
            {st} ({funcionarios.filter(f=>f.setor===st).length})
          </button>
        ))}
      </div>

      {/* Tabela PCMSO */}
      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f9fafb' }}>
              {['Funcionário','Função / Setor','Agentes de risco','Exames recomendados','Último ASO','Status','Ação'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funcsFiltradas.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:'2rem', color:'#9ca3af' }}>Nenhum funcionário.</td></tr>
            ) : funcsFiltradas.map(f => {
              const aso = ultimoAso(f.id)
              const st = statusAso(aso)
              const agentes = agentesDoFuncionario(f)
              const exames = examesRecomendados(agentes)
              return (
                <tr key={f.id} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                  <td style={s.td}>
                    <div style={{ fontWeight:500 }}>{f.nome}</div>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>{f.matricula_esocial}</div>
                  </td>
                  <td style={s.td}>
                    <div>{f.funcao || '—'}</div>
                    <div style={{ fontSize:11, color:'#6b7280' }}>{f.setor || '—'}</div>
                  </td>
                  <td style={s.td}>
                    {agentes.length === 0 ? (
                      <span style={{ color:'#9ca3af', fontSize:11 }}>Sem LTCAT vinculado</span>
                    ) : (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                        {agentes.slice(0,3).map((ag,i) => (
                          <span key={i} style={{ padding:'1px 6px', borderRadius:99, fontSize:10, fontWeight:600, background: ag.tipo==='fis'?'#E6F1FB':ag.tipo==='qui'?'#FAEEDA':ag.tipo==='bio'?'#EAF3DE':'#FCEBEB', color: ag.tipo==='fis'?'#0C447C':ag.tipo==='qui'?'#633806':ag.tipo==='bio'?'#27500A':'#791F1F' }}>
                            {ag.nome.substring(0,20)}{ag.nome.length>20?'...':''}
                          </span>
                        ))}
                        {agentes.length > 3 && <span style={{ fontSize:10, color:'#6b7280' }}>+{agentes.length-3}</span>}
                      </div>
                    )}
                  </td>
                  <td style={s.td}>
                    <div style={{ fontSize:11, color:'#374151', lineHeight:1.8 }}>
                      {exames.slice(0,3).map((e,i) => <div key={i}>• {e}</div>)}
                      {exames.length > 3 && <div style={{ color:'#9ca3af' }}>+{exames.length-3} mais</div>}
                    </div>
                  </td>
                  <td style={s.td}>
                    {aso ? (
                      <>
                        <div style={{ fontSize:12 }}>{new Date(aso.data_exame+'T12:00:00').toLocaleDateString('pt-BR')}</div>
                        <div style={{ fontSize:11, color:'#6b7280' }}>{aso.tipo_aso}</div>
                      </>
                    ) : <span style={{ color:'#9ca3af', fontSize:11 }}>Sem ASO</span>}
                  </td>
                  <td style={s.td}>
                    <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:st.bg, color:st.cor }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={s.td}>
                    <button style={s.btnAcao} onClick={() => router.push(`/s2220?func=${f.id}`)}>
                      {aso ? 'Novo ASO' : 'Agendar ASO'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

const s = {
  header:    { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' },
  titulo:    { fontSize:20, fontWeight:700, color:'#111' },
  sub:       { fontSize:12, color:'#6b7280', marginTop:2 },
  th:        { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'0.5px solid #e5e7eb', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' },
  td:        { padding:'10px 12px', verticalAlign:'top', color:'#374151' },
  filtroBtn: { padding:'5px 12px', fontSize:11, fontWeight:500, borderRadius:99, cursor:'pointer', border:'none', transition:'all .15s' },
  btnPrimary:{ padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnAcao:   { padding:'4px 10px', fontSize:11, background:'transparent', border:'0.5px solid #d1d5db', borderRadius:6, cursor:'pointer', color:'#374151' },
}
