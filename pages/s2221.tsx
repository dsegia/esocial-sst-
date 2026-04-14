import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { getEmpresaId } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TIPO_LBL = { tipico: 'Acidente típico', trajeto: 'Acidente de trajeto', doenca: 'Doença ocupacional' }

export default function S2221() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [funcionarios, setFuncionarios] = useState([])
  const [funcSel, setFuncSel] = useState(null)
  const [catsOrigem, setCatsOrigem] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')
  const [reaberturas, setReaberturas] = useState([])
  const [abaAtiva, setAbaAtiva] = useState<'lista'|'novo'>('lista')
  const [form, setForm] = useState({
    funcionario_id: '',
    cat_origem_id: '',
    dt_reabertura: '',
    cid: '',
    descricao: '',
    medico_unidade: '',
  })

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresaId(user.empresa_id)
    const { data: funcs } = await supabase
      .from('funcionarios')
      .select('id,nome,cpf,matricula_esocial,funcao,setor')
      .eq('empresa_id', user.empresa_id)
      .eq('ativo', true)
      .order('nome')
    setFuncionarios(funcs || [])
    await carregarReaberturas(user.empresa_id)
    setCarregando(false)
  }

  async function carregarReaberturas(eId: string) {
    const { data } = await supabase
      .from('transmissoes')
      .select('id, status, criado_em, payload, funcionario_id, funcionarios(nome, matricula_esocial)')
      .eq('empresa_id', eId)
      .eq('evento', 'S-2221')
      .order('criado_em', { ascending: false })
      .limit(50)
    setReaberturas(data || [])
  }

  async function carregarCatsOrigem(funcId: string, eId: string) {
    if (!funcId || !eId) { setCatsOrigem([]); return }
    const { data } = await supabase
      .from('cats')
      .select('id, tipo_cat, dt_acidente, cid')
      .eq('empresa_id', eId)
      .eq('funcionario_id', funcId)
      .order('dt_acidente', { ascending: false })
    setCatsOrigem(data || [])
  }

  function selecionarFunc(id: string) {
    setForm(f => ({ ...f, funcionario_id: id, cat_origem_id: '' }))
    setFuncSel(funcionarios.find((x: any) => x.id === id) || null)
    setCatsOrigem([])
    if (id && empresaId) carregarCatsOrigem(id, empresaId)
  }

  async function salvar(e) {
    e.preventDefault(); setErro(''); setSucesso(''); setSalvando(true)
    if (!form.funcionario_id) { setErro('Selecione o funcionário.'); setSalvando(false); return }
    if (!form.cat_origem_id) { setErro('Selecione a CAT original.'); setSalvando(false); return }
    if (!form.dt_reabertura) { setErro('Informe a data da reabertura.'); setSalvando(false); return }
    if (!form.cid) { setErro('Informe o CID da reabertura.'); setSalvando(false); return }

    const { error: txErr } = await supabase.from('transmissoes').insert({
      empresa_id: empresaId,
      funcionario_id: form.funcionario_id,
      evento: 'S-2221',
      referencia_id: form.cat_origem_id,
      referencia_tipo: 'cat',
      status: 'pendente',
      tentativas: 0,
      ambiente: 'producao_restrita',
      payload: {
        cat_origem_id: form.cat_origem_id,
        dt_reabertura: form.dt_reabertura,
        cid: form.cid,
        descricao: form.descricao,
        medico_unidade: form.medico_unidade,
      },
    })

    if (txErr) { setErro('Erro ao salvar: ' + txErr.message); setSalvando(false); return }

    setSucesso('Reabertura de CAT registrada! Transmissão S-2221 criada como pendente.')
    setForm({ funcionario_id: '', cat_origem_id: '', dt_reabertura: '', cid: '', descricao: '', medico_unidade: '' })
    setFuncSel(null); setCatsOrigem([])
    setSalvando(false)
    setAbaAtiva('lista')
    carregarReaberturas(empresaId)
  }

  const inp = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box' as const, fontFamily:'inherit' }
  const lbl = { display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 }
  const card = { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }

  if (carregando) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' }}>Carregando...</div>

  const ST_COR: Record<string,[string,string]> = { enviado:['#EAF3DE','#27500A'], pendente:['#FAEEDA','#633806'], rejeitado:['#FCEBEB','#791F1F'] }

  return (
    <Layout pagina="s2221">
      <Head><title>S-2221 Reabertura de CAT — eSocial SST</title></Head>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'#111' }}>S-2221 — Reabertura de CAT</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Comunicação de Acidente de Trabalho — Reabertura de CAT</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ background:'#FCEBEB', color:'#791F1F', padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:600 }}>S-2221</span>
          <button onClick={() => setAbaAtiva('novo')} style={{ padding:'7px 14px', background:'#E24B4A', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>+ Nova Reabertura</button>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display:'flex', gap:2, marginBottom:16, borderBottom:'1px solid #e5e7eb' }}>
        {(['lista','novo'] as const).map(aba => (
          <button key={aba} onClick={() => setAbaAtiva(aba)}
            style={{ padding:'8px 16px', fontSize:13, fontWeight:500, border:'none', background:'none', cursor:'pointer',
              color: abaAtiva===aba ? '#E24B4A' : '#6b7280',
              borderBottom: abaAtiva===aba ? '2px solid #E24B4A' : '2px solid transparent',
              marginBottom:-1 }}>
            {aba === 'lista' ? `Registros (${reaberturas.length})` : 'Nova Reabertura'}
          </button>
        ))}
      </div>

      {sucesso && <div style={{ background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>{sucesso} <a href="/historico" style={{ color:'#085041', fontWeight:500 }}>Ver histórico →</a></div>}
      {erro && <div style={{ background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>{erro}</div>}

      {/* Lista de reaberturas */}
      {abaAtiva === 'lista' && (
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
          {reaberturas.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af', fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
              Nenhuma reabertura de CAT registrada ainda.
              <div style={{ marginTop:12 }}>
                <button onClick={() => setAbaAtiva('novo')} style={{ padding:'8px 16px', background:'#E24B4A', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Registrar primeira reabertura</button>
              </div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f9fafb' }}>
                  {['Funcionário','Data reabertura','CID','Unidade médica','Status','Ações'].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'0.5px solid #e5e7eb', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reaberturas.map((r: any) => {
                  const [stBg, stCor] = ST_COR[r.status] || ['#f3f4f6','#6b7280']
                  const payload = r.payload || {}
                  return (
                    <tr key={r.id} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ fontWeight:500, color:'#111' }}>{r.funcionarios?.nome || '—'}</div>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>{r.funcionarios?.matricula_esocial || ''}</div>
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#374151' }}>
                        {payload.dt_reabertura ? new Date(payload.dt_reabertura+'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:12, fontFamily:'monospace', color:'#374151' }}>{payload.cid || '—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#374151' }}>{payload.medico_unidade || '—'}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:stBg, color:stCor }}>
                          {r.status === 'enviado' ? 'Enviado' : r.status === 'pendente' ? 'Pendente' : 'Rejeitado'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <button onClick={() => router.push('/historico')}
                          style={{ padding:'3px 10px', fontSize:11, background:'transparent', border:'0.5px solid #B5D4F4', borderRadius:6, cursor:'pointer', color:'#185FA5' }}>
                          Ver no histórico
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {abaAtiva === 'novo' && (
        <form onSubmit={salvar}>

          <div style={card}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:14 }}>Trabalhador</div>
            <div style={{ marginBottom:10 }}>
              <label style={lbl}>Selecionar funcionário *</label>
              <select style={inp} value={form.funcionario_id} onChange={e => selecionarFunc(e.target.value)} required>
                <option value="">Selecione o funcionário...</option>
                {funcionarios.map((f: any) => <option key={f.id} value={f.id}>{f.nome} — {f.matricula_esocial}</option>)}
              </select>
            </div>
            {funcSel && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#FCEBEB', borderRadius:8 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'#E24B4A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>
                  {(funcSel as any).nome.split(' ').map((p: string) => p[0]).slice(0,2).join('').toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{(funcSel as any).nome}</div>
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{(funcSel as any).funcao} · {(funcSel as any).setor} · {(funcSel as any).matricula_esocial}</div>
                </div>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:14 }}>CAT original (S-2210)</div>
            <div style={{ marginBottom:10 }}>
              <label style={lbl}>Selecionar CAT a reabrir *</label>
              <select style={inp} value={form.cat_origem_id} onChange={e => setForm(f => ({ ...f, cat_origem_id: e.target.value }))} required disabled={!form.funcionario_id}>
                <option value="">{form.funcionario_id ? 'Selecione a CAT original...' : 'Selecione o funcionário primeiro'}</option>
                {catsOrigem.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.dt_acidente ? new Date(c.dt_acidente+'T12:00:00').toLocaleDateString('pt-BR') : '—'} — {TIPO_LBL[c.tipo_cat as keyof typeof TIPO_LBL] || c.tipo_cat} — CID: {c.cid || '—'}
                  </option>
                ))}
              </select>
              {form.funcionario_id && catsOrigem.length === 0 && (
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:6 }}>Nenhuma CAT encontrada para este funcionário.</div>
              )}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:14 }}>Dados da reabertura</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={lbl}>Data da reabertura *</label>
                <input type="date" style={inp} value={form.dt_reabertura} onChange={e => setForm({ ...form, dt_reabertura: e.target.value })} required />
              </div>
              <div>
                <label style={lbl}>CID da reabertura *</label>
                <input style={inp} placeholder="Ex: S60.0" value={form.cid} onChange={e => setForm({ ...form, cid: e.target.value })} required />
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={lbl}>Unidade de saúde que atendeu</label>
              <input style={inp} placeholder="UPA, Hospital, Clínica..." value={form.medico_unidade} onChange={e => setForm({ ...form, medico_unidade: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>Motivo da reabertura</label>
              <textarea style={{ ...inp, minHeight:80, resize:'vertical', lineHeight:1.5 }} placeholder="Descreva a recidiva ou agravamento do acidente..." value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button type="submit" disabled={salvando} style={{ padding:'10px 20px', background:'#E24B4A', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity:salvando ? 0.5 : 1 }}>
              {salvando ? 'Salvando...' : 'Salvar Reabertura'}
            </button>
            <button type="button" onClick={() => setAbaAtiva('lista')} style={{ padding:'10px 20px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, color:'#374151', cursor:'pointer' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Layout>
  )
}
