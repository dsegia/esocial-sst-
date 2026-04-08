import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function S2240() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [funcionarios, setFuncionarios] = useState([])
  const [ltcatAtivo, setLtcatAtivo] = useState(null)
  const [transmissoes, setTransmissoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresaId(user.empresa_id)

    const [funcsRes, ltcatRes, txRes] = await Promise.all([
      supabase.from('funcionarios').select('id,nome,cpf,matricula_esocial,funcao,setor,data_adm,data_nasc').eq('empresa_id', user.empresa_id).eq('ativo', true).order('nome'),
      supabase.from('ltcats').select('*').eq('empresa_id', user.empresa_id).eq('ativo', true).order('data_emissao', { ascending: false }).limit(1).single(),
      supabase.from('transmissoes').select('id,status,evento,funcionario_id,recibo,dt_envio,criado_em,erro_descricao').eq('empresa_id', user.empresa_id).eq('evento', 'S-2240').order('criado_em', { ascending: false }),
    ])

    setFuncionarios(funcsRes.data || [])
    setLtcatAtivo(ltcatRes.data || null)
    setTransmissoes(txRes.data || [])
    setCarregando(false)
  }

  function ultimaTx(funcId) {
    return transmissoes.filter(t => t.funcionario_id === funcId)[0] || null
  }

  // GHE do funcionário baseado no setor
  function gheDoFuncionario(func) {
    if (!ltcatAtivo?.ghes) return null
    for (const ghe of ltcatAtivo.ghes) {
      const setorGHE  = (ghe.setor||'').toLowerCase()
      const setorFunc = (func.setor||'').toLowerCase()
      if (setorGHE && setorFunc && (setorGHE.includes(setorFunc) || setorFunc.includes(setorGHE))) {
        return ghe
      }
    }
    // Se só tem um GHE, assume que é dele
    if (ltcatAtivo.ghes.length === 1) return ltcatAtivo.ghes[0]
    return null
  }

  function statusFuncionario(func) {
    const tx  = ultimaTx(func.id)
    const ghe = gheDoFuncionario(func)
    const dadosOk = func.data_adm && func.data_nasc && func.matricula_esocial && !func.matricula_esocial.startsWith('PEND-')

    if (!ltcatAtivo) return { label:'Sem LTCAT', cor:'#E24B4A', bg:'#FCEBEB', pode:false, motivo:'Nenhum LTCAT ativo cadastrado' }
    if (!dadosOk)    return { label:'Dados incompletos', cor:'#EF9F27', bg:'#FAEEDA', pode:false, motivo:'Faltam: admissão, nascimento ou matrícula eSocial' }

    if (!tx) return { label:'Não transmitido', cor:'#EF9F27', bg:'#FAEEDA', pode:true, motivo:'S-2240 ainda não enviado para este funcionário' }
    if (tx.status === 'enviado')   return { label:'Transmitido', cor:'#1D9E75', bg:'#EAF3DE', pode:false, motivo:`Recibo: ${tx.recibo||'—'}` }
    if (tx.status === 'pendente')  return { label:'Pendente', cor:'#EF9F27', bg:'#FAEEDA', pode:true, motivo:'Aguardando transmissão' }
    if (tx.status === 'rejeitado') return { label:'Rejeitado', cor:'#E24B4A', bg:'#FCEBEB', pode:true, motivo: tx.erro_descricao || 'Verifique o erro e retransmita' }

    return { label:'Em dia', cor:'#1D9E75', bg:'#EAF3DE', pode:false, motivo:'' }
  }

  async function criarTransmissao(funcId) {
    const { error } = await supabase.from('transmissoes').insert({
      empresa_id: empresaId,
      funcionario_id: funcId,
      evento: 'S-2240',
      referencia_id: ltcatAtivo.id,
      referencia_tipo: 'ltcat',
      status: 'pendente',
      tentativas: 0,
      ambiente: 'producao_restrita',
    })
    if (error) { setErro('Erro ao criar transmissão: ' + error.message); return }
    setSucesso('Transmissão S-2240 criada. Acesse Transmissão para enviar.')
    init()
  }

  async function criarParaTodos() {
    const semTx = funcsFiltradas.filter(f => {
      const st = statusFuncionario(f)
      return st.label === 'Não transmitido' && !statusFuncionario(f).pode === false
    }).filter(f => statusFuncionario(f).pode)

    for (const f of semTx) {
      await criarTransmissao(f.id)
    }
    setSucesso(`${semTx.length} transmissão(ões) S-2240 criada(s). Acesse Transmissão para enviar.`)
  }

  const funcsFiltradas = funcionarios.filter(f => {
    const st = statusFuncionario(f)
    if (filtro === 'todos') return true
    if (filtro === 'pendente') return st.pode
    if (filtro === 'ok') return st.label === 'Transmitido'
    if (filtro === 'problema') return ['Sem LTCAT','Dados incompletos','Rejeitado'].includes(st.label)
    return true
  })

  const prontos   = funcionarios.filter(f => statusFuncionario(f).pode)
  const problemas = funcionarios.filter(f => ['Sem LTCAT','Dados incompletos','Rejeitado'].includes(statusFuncionario(f).label))

  if (carregando) return <div style={s.loading}>Carregando...</div>

  return (
    <Layout pagina="s2240">
      <Head><title>S-2240 — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>S-2240 — Condições Ambientais do Trabalho</div>
          <div style={s.sub}>{prontos.length} funcionário(s) com transmissão pendente · {problemas.length} com problema</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={s.btnOutline} onClick={() => router.push('/ltcat')}>Ver LTCAT</button>
          {prontos.length > 0 && (
            <button style={s.btnPrimary} onClick={() => router.push('/transmissao-manual')}>
              📡 Transmitir pendentes ({prontos.length})
            </button>
          )}
        </div>
      </div>

      {sucesso && <div style={s.sucessoBox}>{sucesso}</div>}
      {erro    && <div style={s.erroBox}>{erro}</div>}

      {/* Status LTCAT */}
      {ltcatAtivo ? (
        <div style={{ background:'#EAF3DE', border:'0.5px solid #C0DD97', borderRadius:10, padding:'10px 16px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:13, color:'#085041' }}>
            ✓ LTCAT ativo: emitido em <strong>{new Date(ltcatAtivo.data_emissao+'T12:00:00').toLocaleDateString('pt-BR')}</strong>
            · {ltcatAtivo.ghes?.length||0} GHE(s)
            · Resp: {ltcatAtivo.resp_nome||'—'}
          </div>
          <button style={{ ...s.btnOutline, padding:'4px 10px', fontSize:12 }} onClick={() => router.push('/ltcat')}>
            Editar LTCAT →
          </button>
        </div>
      ) : (
        <div style={{ background:'#FCEBEB', border:'1px solid #E24B4A', borderRadius:10, padding:'12px 16px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:13, color:'#791F1F' }}>
            ⚠ Nenhum LTCAT ativo. O S-2240 requer um LTCAT cadastrado para identificar os agentes de risco.
          </div>
          <button style={s.btnPrimary} onClick={() => router.push('/ltcat')}>Cadastrar LTCAT →</button>
        </div>
      )}

      {/* Ação em massa */}
      {prontos.length > 0 && ltcatAtivo && (
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:13, color:'#374151' }}>
            <strong style={{ color:'#EF9F27' }}>{prontos.length}</strong> funcionário(s) precisam ter S-2240 transmitido
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button style={s.btnOutline} onClick={criarParaTodos}>
              Criar transmissões para todos
            </button>
            <button style={s.btnPrimary} onClick={() => router.push('/transmissao-manual')}>
              📡 Ir para transmissão
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        {[
          { k:'todos',    l:`Todos (${funcionarios.length})` },
          { k:'pendente', l:`Pendentes (${prontos.length})` },
          { k:'ok',       l:`Transmitidos (${funcionarios.filter(f=>statusFuncionario(f).label==='Transmitido').length})` },
          { k:'problema', l:`Problemas (${problemas.length})` },
        ].map(f => (
          <button key={f.k} onClick={() => setFiltro(f.k)} style={{
            padding:'5px 12px', fontSize:12, fontWeight:500, borderRadius:99, cursor:'pointer', border:'none',
            background: filtro===f.k?'#185FA5':'#f3f4f6', color: filtro===f.k?'#fff':'#374151',
          }}>{f.l}</button>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f9fafb' }}>
              {['Funcionário','Função / Setor','GHE vinculado','Agentes de risco','Última transmissão','Status','Ações'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funcsFiltradas.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:'2rem', color:'#9ca3af', fontSize:13 }}>
                Nenhum funcionário neste filtro.
              </td></tr>
            ) : funcsFiltradas.map(f => {
              const tx  = ultimaTx(f.id)
              const st  = statusFuncionario(f)
              const ghe = gheDoFuncionario(f)
              return (
                <tr key={f.id} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                  <td style={s.td}>
                    <div style={{ fontWeight:500 }}>{f.nome}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>
                      {f.matricula_esocial?.startsWith('PEND-') ? <span style={{color:'#EF9F27'}}>Matrícula pendente</span> : f.matricula_esocial}
                    </div>
                  </td>
                  <td style={s.td}>
                    <div style={{ fontSize:13 }}>{f.funcao||'—'}</div>
                    <div style={{ fontSize:11, color:'#6b7280' }}>{f.setor||'—'}</div>
                  </td>
                  <td style={s.td}>
                    {ghe ? (
                      <div>
                        <div style={{ fontSize:12, fontWeight:500 }}>{ghe.nome||'—'}</div>
                        <div style={{ fontSize:11, color:'#6b7280' }}>{ghe.qtd_trabalhadores} trabalhador(es)</div>
                        {ghe.aposentadoria_especial && (
                          <span style={{ fontSize:10, color:'#791F1F', fontWeight:600 }}>⚠ Aposent. especial</span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize:11, color:'#9ca3af' }}>
                        {ltcatAtivo ? 'Setor não mapeado no LTCAT' : '—'}
                      </span>
                    )}
                  </td>
                  <td style={s.td}>
                    {ghe?.agentes?.length ? (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                        {ghe.agentes.slice(0,3).map((ag,i) => {
                          const COR = { fis:'#E6F1FB', qui:'#FAEEDA', bio:'#EAF3DE', erg:'#FCEBEB' }
                          const TXT = { fis:'#0C447C', qui:'#633806', bio:'#27500A', erg:'#791F1F' }
                          return (
                            <span key={i} style={{ padding:'1px 6px', borderRadius:99, fontSize:10, fontWeight:500, background:COR[ag.tipo]||'#f3f4f6', color:TXT[ag.tipo]||'#374151' }}>
                              {ag.nome?.substring(0,18)}{ag.nome?.length>18?'...':''}
                            </span>
                          )
                        })}
                        {ghe.agentes.length > 3 && <span style={{ fontSize:10, color:'#9ca3af' }}>+{ghe.agentes.length-3}</span>}
                      </div>
                    ) : (
                      <span style={{ fontSize:11, color:'#9ca3af' }}>
                        {ghe ? 'Sem agentes no GHE' : '—'}
                      </span>
                    )}
                  </td>
                  <td style={s.td}>
                    {tx ? (
                      <div>
                        <div style={{ fontSize:11 }}>{new Date(tx.criado_em).toLocaleDateString('pt-BR')}</div>
                        <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>
                          {tx.recibo ? tx.recibo.substring(0,12)+'...' : '—'}
                        </div>
                        {tx.erro_descricao && (
                          <div style={{ fontSize:10, color:'#E24B4A', marginTop:2 }} title={tx.erro_descricao}>
                            {tx.erro_descricao.substring(0,30)}...
                          </div>
                        )}
                      </div>
                    ) : <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>}
                  </td>
                  <td style={s.td}>
                    <div>
                      <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:st.bg, color:st.cor }}>
                        {st.label}
                      </span>
                      {st.motivo && <div style={{ fontSize:10, color:'#9ca3af', marginTop:3, maxWidth:160 }}>{st.motivo}</div>}
                    </div>
                  </td>
                  <td style={s.td}>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {st.label === 'Não transmitido' && ltcatAtivo && (
                        <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }}
                          onClick={() => criarTransmissao(f.id)}>
                          Criar S-2240
                        </button>
                      )}
                      {st.pode && tx && (
                        <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }}
                          onClick={() => router.push('/transmissao-manual')}>
                          Transmitir
                        </button>
                      )}
                      {st.label === 'Dados incompletos' && (
                        <button style={{ ...s.btnAcao, color:'#EF9F27', borderColor:'#FAC775' }}
                          onClick={() => router.push('/funcionarios')}>
                          Completar dados
                        </button>
                      )}
                      {!ghe && ltcatAtivo && (
                        <button style={{ ...s.btnAcao, color:'#633806', borderColor:'#FAC775' }}
                          onClick={() => router.push('/ltcat')}>
                          Mapear GHE
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
}
