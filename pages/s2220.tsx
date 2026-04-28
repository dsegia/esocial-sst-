import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { pdfConformidadeASO } from '../lib/gerarPDF'
import { getEmpresaId } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function S2220() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpjEmpresa, setCnpjEmpresa] = useState('')
  const [funcionarios, setFuncionarios] = useState([])
  const [asos, setAsos] = useState([])
  const [transmissoes, setTransmissoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: user } = await supabase.from('usuarios')
      .select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/login'); return }
    const empId = getEmpresaId() || user.empresa_id
    setEmpresaId(empId)
    supabase.from('empresas').select('razao_social,cnpj').eq('id', empId).single()
      .then(({ data: emp }) => { if (emp) { setNomeEmpresa(emp.razao_social); setCnpjEmpresa(emp.cnpj) } })

    const [funcsRes, asosRes, txRes] = await Promise.all([
      supabase.from('funcionarios')
        .select('id,nome,cpf,matricula_esocial,funcao,cod_cbo,setor,data_adm,data_nasc')
        .eq('empresa_id', empId).eq('ativo', true).order('nome'),
      supabase.from('asos').select('*')
        .eq('empresa_id', empId)
        .order('data_exame', { ascending: false }),
      supabase.from('transmissoes')
        .select('id,status,evento,funcionario_id,recibo,dt_envio,criado_em,erro_descricao')
        .eq('empresa_id', empId).eq('evento', 'S-2220')
        .order('criado_em', { ascending: false }),
    ])

    setFuncionarios(funcsRes.data || [])
    setAsos(asosRes.data || [])
    setTransmissoes(txRes.data || [])
    setCarregando(false)
  }

  function ultimoAso(funcId) {
    return asos
      .filter(a => a.funcionario_id === funcId)
      .sort((a,b) => new Date(b.data_exame) - new Date(a.data_exame))[0] || null
  }

  function ultimaTx(funcId) {
    return transmissoes.filter(t => t.funcionario_id === funcId)[0] || null
  }

  function diasParaVencer(d) {
    if (!d) return null
    return Math.round((new Date(d) - new Date()) / 86400000)
  }

  function statusFuncionario(func) {
    const aso   = ultimoAso(func.id)
    const tx    = ultimaTx(func.id)
    const dadosOk = func.data_adm && func.data_nasc &&
                    func.matricula_esocial && !func.matricula_esocial.startsWith('PEND-')

    if (!aso)     return { label:'Sem ASO',          cor:'#E24B4A', bg:'#FCEBEB', pode:false, motivo:'Importe ou cadastre um ASO' }
    if (!dadosOk) return { label:'Dados incompletos', cor:'#EF9F27', bg:'#FAEEDA', pode:false, motivo:'Faltam: admissão, nascimento ou matrícula eSocial' }

    const dias = diasParaVencer(aso.prox_exame)
    const vencido = dias !== null && dias < 0

    if (!tx) return { label:'Pendente envio', cor:'#EF9F27', bg:'#FAEEDA', pode:true, motivo:'ASO cadastrado — aguardando transmissão' }

    if (tx.status === 'enviado')   return { label:'Transmitido',    cor:'#1D9E75', bg:'#EAF3DE', pode:false, motivo:`Recibo: ${tx.recibo||'—'}` }
    if (tx.status === 'pendente')  return { label:'Aguardando',     cor:'#EF9F27', bg:'#FAEEDA', pode:true,  motivo:'Transmissão pendente' }
    if (tx.status === 'rejeitado') return { label:'Rejeitado',      cor:'#E24B4A', bg:'#FCEBEB', pode:true,  motivo:tx.erro_descricao||'Verifique o erro e retransmita' }

    if (vencido) return { label:'ASO vencido', cor:'#E24B4A', bg:'#FCEBEB', pode:true, motivo:`Vencido há ${Math.abs(dias)} dias` }

    return { label:'Em dia', cor:'#1D9E75', bg:'#EAF3DE', pode:false, motivo:'' }
  }

  // Só mostra funcionários que têm ASO importado e associado
  const funcsComAso = funcionarios.filter(f => ultimoAso(f.id) !== null)

  const funcsFiltradas = funcsComAso.filter(f => {
    const st = statusFuncionario(f)
    if (filtro === 'todos')    return true
    if (filtro === 'pendente') return st.pode
    if (filtro === 'ok')       return st.label === 'Transmitido'
    if (filtro === 'problema') return ['Dados incompletos','Rejeitado','ASO vencido'].includes(st.label)
    return true
  })

  const prontos   = funcsComAso.filter(f => statusFuncionario(f).pode)
  const problemas = funcsComAso.filter(f =>
    ['Dados incompletos','Rejeitado','ASO vencido'].includes(statusFuncionario(f).label)
  )
  const transmitidos = funcsComAso.filter(f => statusFuncionario(f).label === 'Transmitido')

  if (carregando) return <div style={s.loading}>Carregando...</div>

  return (
    <Layout pagina="s2220">
      <Head><title>S-2220 — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>S-2220 — Monitoramento da Saúde do Trabalhador</div>
          <div style={s.sub}>
            {prontos.length} pendente(s) · {transmitidos.length} transmitido(s) · {problemas.length} com problema
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {prontos.length > 0 && (
            <button style={s.btnPrimary} onClick={() => router.push('/transmissao-manual')}>
              📡 Transmitir pendentes ({prontos.length})
            </button>
          )}
        </div>
      </div>

      {sucesso && <div style={s.sucessoBox}>{sucesso}</div>}
      {erro    && <div style={s.erroBox}>{erro}</div>}

      {/* Resumo ação em massa */}
      {prontos.length > 0 && (
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:13, color:'#374151' }}>
            <strong style={{ color:'#EF9F27' }}>{prontos.length}</strong> funcionário(s) com transmissão S-2220 pendente
          </div>
          <button style={s.btnPrimary} onClick={() => router.push('/transmissao-manual')}>
            📡 Ir para transmissão
          </button>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        {[
          { k:'todos',    l:`Todos (${funcsComAso.length})` },
          { k:'pendente', l:`Pendentes (${prontos.length})` },
          { k:'ok',       l:`Transmitidos (${transmitidos.length})` },
          { k:'problema', l:`Problemas (${problemas.length})` },
        ].map(f => (
          <button key={f.k} onClick={() => setFiltro(f.k)} style={{
            padding:'5px 12px', fontSize:12, fontWeight:500, borderRadius:99, cursor:'pointer', border:'none',
            background: filtro===f.k?'#185FA5':'#f3f4f6',
            color:      filtro===f.k?'#fff':'#374151',
          }}>{f.l}</button>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f9fafb' }}>
              {['Funcionário','Matrícula','Último ASO','Próximo exame','Última transmissão','Status','Ações'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funcsFiltradas.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign:'center', padding:'2rem', color:'#9ca3af', fontSize:13 }}>
                  Nenhum funcionário neste filtro.
                </td>
              </tr>
            ) : funcsFiltradas.map(f => {
              const aso = ultimoAso(f.id)
              const tx  = ultimaTx(f.id)
              const st  = statusFuncionario(f)
              const dias = aso?.prox_exame ? diasParaVencer(aso.prox_exame) : null
              return (
                <tr key={f.id} style={{ borderBottom:'0.5px solid #f3f4f6' }}>

                  {/* Funcionário */}
                  <td style={s.td}>
                    <div style={{ fontWeight:500 }}>{f.nome}</div>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>{f.funcao||'—'} · {f.setor||'—'}</div>
                  </td>

                  {/* Matrícula */}
                  <td style={{ ...s.td, fontFamily:'monospace', fontSize:11 }}>
                    {f.matricula_esocial?.startsWith('PEND-')
                      ? <span style={{ color:'#EF9F27' }}>Pendente</span>
                      : f.matricula_esocial || '—'}
                  </td>

                  {/* Último ASO */}
                  <td style={s.td}>
                    {aso ? (
                      <div>
                        <div style={{ fontSize:12 }}>
                          {new Date(aso.data_exame+'T12:00:00').toLocaleDateString('pt-BR')}
                        </div>
                        <div style={{ fontSize:10, color:'#9ca3af' }}>
                          {aso.tipo_aso} · {aso.conclusao}
                        </div>
                        {aso.medico_nome && (
                          <div style={{ fontSize:10, color:'#9ca3af' }}>{aso.medico_nome}</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color:'#E24B4A', fontSize:12 }}>Sem ASO</span>
                    )}
                  </td>

                  {/* Próximo exame */}
                  <td style={s.td}>
                    {aso?.prox_exame ? (
                      <div>
                        <div style={{ fontSize:12, color: dias !== null && dias < 0 ? '#E24B4A' : dias !== null && dias <= 30 ? '#EF9F27' : '#374151' }}>
                          {new Date(aso.prox_exame+'T12:00:00').toLocaleDateString('pt-BR')}
                        </div>
                        {dias !== null && (
                          <div style={{ fontSize:10, color: dias < 0?'#E24B4A': dias<=30?'#EF9F27':'#9ca3af' }}>
                            {dias < 0 ? `Vencido há ${Math.abs(dias)}d` : `em ${dias} dias`}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>
                    )}
                  </td>

                  {/* Última transmissão */}
                  <td style={s.td}>
                    {tx ? (
                      <div>
                        <div style={{ fontSize:11 }}>
                          {new Date(tx.criado_em).toLocaleDateString('pt-BR')}
                        </div>
                        <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>
                          {tx.recibo ? tx.recibo.substring(0,12)+'...' : '—'}
                        </div>
                        {tx.erro_descricao && (
                          <div style={{ fontSize:10, color:'#E24B4A', marginTop:2 }} title={tx.erro_descricao}>
                            {tx.erro_descricao.substring(0,30)}...
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td style={s.td}>
                    <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:st.bg, color:st.cor }}>
                      {st.label}
                    </span>
                    {st.motivo && (
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:3, maxWidth:160 }}>
                        {st.motivo}
                      </div>
                    )}
                  </td>

                  {/* Ações */}
                  <td style={s.td}>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {st.pode && (
                        <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }}
                          onClick={() => router.push('/transmissao-manual')}>
                          Transmitir
                        </button>
                      )}
                    </div>
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
  loading:    { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' },
  header:     { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' },
  titulo:     { fontSize:18, fontWeight:700, color:'#111' },
  sub:        { fontSize:12, color:'#6b7280', marginTop:2 },
  th:         { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'0.5px solid #e5e7eb', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' },
  td:         { padding:'10px 12px', verticalAlign:'top', color:'#374151' },
  btnAcao:    { padding:'3px 10px', fontSize:11, background:'transparent', border:'0.5px solid #d1d5db', borderRadius:6, cursor:'pointer', color:'#374151', whiteSpace:'nowrap' },
  btnPrimary: { padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnOutline: { padding:'8px 14px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', color:'#374151' },
  erroBox:    { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  sucessoBox: { background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },

  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modal:      { background:'#fff', borderRadius:12, padding:'1.5rem', width:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' },
  inputModal: { width:'100%', padding:'7px 9px', fontSize:12, border:'1px solid #d1d5db', borderRadius:7, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' },}