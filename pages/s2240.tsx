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
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    funcionario_id: '',
    data_emissao: '',
    data_vigencia: '',
    prox_revisao: '',
    resp_nome: '',
    resp_conselho: 'CREA',
    resp_registro: '',
  })
  const [ghes, setGhes] = useState([
    { nome: 'GHE 01', setor: '', qtd_trabalhadores: 1, aposentadoria_especial: false,
      agentes: [{ tipo: 'fis', nome: 'Ruído', valor: '', limite: '85 dB(A)', supera_lt: false }],
      epc: [{ nome: '', eficaz: true }],
      epi: [{ nome: '', ca: '', eficaz: true }] }
  ])

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresaId(user.empresa_id)
    const { data: funcs } = await supabase.from('funcionarios').select('id,nome,matricula_esocial,setor').eq('empresa_id', user.empresa_id).eq('ativo', true).order('nome')
    setFuncionarios(funcs || [])
    setCarregando(false)
  }

  function updGhe(i, campo, val) { const g = [...ghes]; g[i][campo] = val; setGhes(g) }
  function addGhe() { setGhes([...ghes, { nome: 'GHE 0'+(ghes.length+1), setor:'', qtd_trabalhadores:1, aposentadoria_especial:false, agentes:[{tipo:'fis',nome:'',valor:'',limite:'',supera_lt:false}], epc:[{nome:'',eficaz:true}], epi:[{nome:'',ca:'',eficaz:true}] }]) }
  function remGhe(i) { if(ghes.length>1) setGhes(ghes.filter((_,idx)=>idx!==i)) }

  async function salvar(e) {
    e.preventDefault(); setErro(''); setSucesso(''); setSalvando(true)
    if (!form.funcionario_id) { setErro('Selecione o funcionário.'); setSalvando(false); return }
    if (!form.data_emissao) { setErro('Informe a data de emissão do LTCAT.'); setSalvando(false); return }

    const { data: ltcat, error: ltErr } = await supabase.from('ltcats').insert({
      empresa_id: empresaId,
      data_emissao: form.data_emissao,
      data_vigencia: form.data_vigencia || form.data_emissao,
      prox_revisao: form.prox_revisao || null,
      resp_nome: form.resp_nome,
      resp_conselho: form.resp_conselho,
      resp_registro: form.resp_registro,
      ghes: ghes,
      ativo: true,
    }).select().single()

    if (ltErr) { setErro('Erro ao salvar: ' + ltErr.message); setSalvando(false); return }

    await supabase.from('transmissoes').insert({
      empresa_id: empresaId,
      funcionario_id: form.funcionario_id,
      evento: 'S-2240',
      referencia_id: ltcat.id,
      referencia_tipo: 'ltcat',
      status: 'pendente',
      tentativas: 0,
      ambiente: 'producao_restrita',
    })

    setSucesso('LTCAT salvo! Transmissão S-2240 criada como pendente.')
    setSalvando(false)
  }

  const inp = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' }
  const lbl = { display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 }
  const card = { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }

  if (carregando) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' }}>Carregando...</div>

  return (
    <Layout pagina="s2240">
      <Head><title>S-2240 LTCAT — eSocial SST</title></Head>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'#111' }}>S-2240 — LTCAT</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Condições Ambientais de Trabalho · NR-9</div>
        </div>
        <span style={{ background:'#FAEEDA', color:'#633806', padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:600 }}>S-2240</span>
      </div>

      {sucesso && <div style={{ background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>{sucesso} <a href="/historico" style={{ color:'#085041', fontWeight:500 }}>Ver histórico →</a></div>}
      {erro && <div style={{ background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>{erro}</div>}

      <form onSubmit={salvar}>
        <div style={card}>
          <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:14 }}>Funcionário e dados gerais</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div><label style={lbl}>Funcionário *</label>
              <select style={inp} value={form.funcionario_id} onChange={e => setForm({...form, funcionario_id:e.target.value})} required>
                <option value="">Selecione...</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.matricula_esocial}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Data de emissão *</label>
              <input type="date" style={inp} value={form.data_emissao} onChange={e => setForm({...form, data_emissao:e.target.value})} required />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div><label style={lbl}>Início da vigência</label>
              <input type="date" style={inp} value={form.data_vigencia} onChange={e => setForm({...form, data_vigencia:e.target.value})} />
            </div>
            <div><label style={lbl}>Próxima revisão</label>
              <input type="date" style={inp} value={form.prox_revisao} onChange={e => setForm({...form, prox_revisao:e.target.value})} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:10 }}>
            <div><label style={lbl}>Responsável técnico *</label>
              <input style={inp} placeholder="Nome do engenheiro/técnico" value={form.resp_nome} onChange={e => setForm({...form, resp_nome:e.target.value})} />
            </div>
            <div><label style={lbl}>Conselho</label>
              <select style={{...inp, width:90}} value={form.resp_conselho} onChange={e => setForm({...form, resp_conselho:e.target.value})}>
                <option>CREA</option><option>CRQ</option><option>CRM</option>
              </select>
            </div>
            <div><label style={lbl}>Registro</label>
              <input style={inp} placeholder="123456-D/SP" value={form.resp_registro} onChange={e => setForm({...form, resp_registro:e.target.value})} />
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>GHEs — Grupos Homogêneos de Exposição</div>
            <button type="button" onClick={addGhe} style={{ padding:'5px 12px', background:'#185FA5', color:'#fff', border:'none', borderRadius:7, fontSize:12, cursor:'pointer' }}>+ GHE</button>
          </div>
          {ghes.map((g, gi) => (
            <div key={gi} style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:'1rem', marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto auto', gap:8, flex:1, marginRight:8 }}>
                  <div><label style={lbl}>Nome do GHE</label>
                    <input style={inp} value={g.nome} onChange={e => updGhe(gi,'nome',e.target.value)} />
                  </div>
                  <div><label style={lbl}>Setor</label>
                    <input style={inp} placeholder="Ex: Produção" value={g.setor} onChange={e => updGhe(gi,'setor',e.target.value)} />
                  </div>
                  <div><label style={lbl}>Qtd trabalhadores</label>
                    <input type="number" style={{...inp, width:80}} min="1" value={g.qtd_trabalhadores} onChange={e => updGhe(gi,'qtd_trabalhadores',parseInt(e.target.value)||1)} />
                  </div>
                  <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:2 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#374151', cursor:'pointer' }}>
                      <input type="checkbox" checked={g.aposentadoria_especial} onChange={e => updGhe(gi,'aposentadoria_especial',e.target.checked)} />
                      Ap. especial
                    </label>
                  </div>
                </div>
                {ghes.length > 1 && <button type="button" onClick={() => remGhe(gi)} style={{ background:'#FCEBEB', border:'none', color:'#791F1F', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12 }}>Remover</button>}
              </div>

              <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Agentes de risco</div>
              {g.agentes.map((ag, ai) => (
                <div key={ai} style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr 1fr auto', gap:6, marginBottom:6 }}>
                  <select style={{...inp, padding:'6px 6px'}} value={ag.tipo} onChange={e => { const gh=[...ghes]; gh[gi].agentes[ai].tipo=e.target.value; setGhes(gh) }}>
                    <option value="fis">Físico</option><option value="qui">Químico</option><option value="bio">Biológico</option><option value="erg">Ergonômico</option>
                  </select>
                  <input style={{...inp,padding:'6px 8px'}} placeholder="Nome do agente" value={ag.nome} onChange={e => { const gh=[...ghes]; gh[gi].agentes[ai].nome=e.target.value; setGhes(gh) }} />
                  <input style={{...inp,padding:'6px 8px'}} placeholder="Valor medido" value={ag.valor} onChange={e => { const gh=[...ghes]; gh[gi].agentes[ai].valor=e.target.value; setGhes(gh) }} />
                  <input style={{...inp,padding:'6px 8px'}} placeholder="Limite tolerância" value={ag.limite} onChange={e => { const gh=[...ghes]; gh[gi].agentes[ai].limite=e.target.value; setGhes(gh) }} />
                  <button type="button" onClick={() => { const gh=[...ghes]; gh[gi].agentes=gh[gi].agentes.filter((_,x)=>x!==ai); setGhes(gh) }} style={{ background:'none', border:'none', color:'#9ca3af', fontSize:16, cursor:'pointer' }}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => { const gh=[...ghes]; gh[gi].agentes.push({tipo:'fis',nome:'',valor:'',limite:'',supera_lt:false}); setGhes(gh) }}
                style={{ fontSize:11, color:'#185FA5', background:'none', border:'none', cursor:'pointer', padding:0, marginBottom:10 }}>+ agente</button>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>EPI</div>
                  {g.epi.map((ep, ei) => (
                    <div key={ei} style={{ display:'flex', gap:6, marginBottom:5 }}>
                      <input style={{...inp,flex:1,padding:'6px 8px'}} placeholder="Nome do EPI" value={ep.nome} onChange={e => { const gh=[...ghes]; gh[gi].epi[ei].nome=e.target.value; setGhes(gh) }} />
                      <input style={{...inp,width:90,padding:'6px 8px'}} placeholder="CA" value={ep.ca} onChange={e => { const gh=[...ghes]; gh[gi].epi[ei].ca=e.target.value; setGhes(gh) }} />
                    </div>
                  ))}
                  <button type="button" onClick={() => { const gh=[...ghes]; gh[gi].epi.push({nome:'',ca:'',eficaz:true}); setGhes(gh) }}
                    style={{ fontSize:11, color:'#185FA5', background:'none', border:'none', cursor:'pointer', padding:0 }}>+ EPI</button>
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>EPC</div>
                  {g.epc.map((ep, ei) => (
                    <div key={ei} style={{ marginBottom:5 }}>
                      <input style={{...inp,padding:'6px 8px'}} placeholder="Nome do EPC" value={ep.nome} onChange={e => { const gh=[...ghes]; gh[gi].epc[ei].nome=e.target.value; setGhes(gh) }} />
                    </div>
                  ))}
                  <button type="button" onClick={() => { const gh=[...ghes]; gh[gi].epc.push({nome:'',eficaz:true}); setGhes(gh) }}
                    style={{ fontSize:11, color:'#185FA5', background:'none', border:'none', cursor:'pointer', padding:0 }}>+ EPC</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button type="submit" disabled={salvando} style={{ padding:'10px 20px', background:'#EF9F27', color:'#412402', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity:salvando?0.7:1 }}>
            {salvando ? 'Salvando...' : 'Salvar LTCAT'}
          </button>
          <button type="button" onClick={() => router.push('/historico')} style={{ padding:'10px 20px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, color:'#374151', cursor:'pointer' }}>
            Ver histórico
          </button>
        </div>
      </form>
    </Layout>
  )
}
