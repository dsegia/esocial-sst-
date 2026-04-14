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

const TIPOS_CAT = [
  { v: 'tipico', l: 'Acidente típico', desc: 'Ocorreu durante o exercício da atividade profissional' },
  { v: 'trajeto', l: 'Acidente de trajeto', desc: 'Percurso entre residência e trabalho' },
  { v: 'doenca', l: 'Doença ocupacional', desc: 'Doença causada ou agravada pelo trabalho' },
]

const TIPO_LBL = { tipico: 'Acidente típico', trajeto: 'Acidente de trajeto', doenca: 'Doença ocupacional' }

export default function S2210() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [funcionarios, setFuncionarios] = useState([])
  const [funcSel, setFuncSel] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')
  const [tipoCat, setTipoCat] = useState('')
  const [cats, setCats] = useState([])
  const [abaAtiva, setAbaAtiva] = useState<'lista'|'novo'>('lista')
  const [form, setForm] = useState({
    funcionario_id: '',
    dt_acidente: '',
    hora_acidente: '',
    cid: '',
    natureza_lesao: '',
    parte_corpo: '',
    agente_causador: '',
    descricao: '',
    houve_morte: false,
    dias_afastamento: '',
    med_unidade: '',
    med_data: '',
    med_hora: '',
    med_medico: '',
    med_crm: '',
  })

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    const empId = getEmpresaId() || user.empresa_id
    setEmpresaId(empId)
    const { data: funcs } = await supabase.from('funcionarios').select('id,nome,cpf,matricula_esocial,funcao,setor').eq('empresa_id', empId).eq('ativo', true).order('nome')
    setFuncionarios(funcs || [])
    await carregarCats(empId)
    setCarregando(false)
  }

  async function carregarCats(eId: string) {
    const { data } = await supabase
      .from('cats')
      .select('id, tipo_cat, dt_acidente, cid, natureza_lesao, houve_morte, criado_em, funcionarios(nome, matricula_esocial), transmissoes(status, recibo)')
      .eq('empresa_id', eId)
      .order('dt_acidente', { ascending: false })
      .limit(50)
    setCats(data || [])
  }

  function selecionarFunc(id) {
    setForm(f => ({ ...f, funcionario_id: id }))
    setFuncSel(funcionarios.find(x => x.id === id) || null)
  }

  async function salvar(e) {
    e.preventDefault(); setErro(''); setSucesso(''); setSalvando(true)
    if (!tipoCat) { setErro('Selecione o tipo de CAT.'); setSalvando(false); return }
    if (!form.funcionario_id) { setErro('Selecione o funcionário.'); setSalvando(false); return }
    if (!form.dt_acidente) { setErro('Informe a data do acidente.'); setSalvando(false); return }
    if (!form.cid) { setErro('Informe o CID-10.'); setSalvando(false); return }

    const { data: cat, error: catErr } = await supabase.from('cats').insert({
      funcionario_id: form.funcionario_id,
      empresa_id: empresaId,
      tipo_cat: tipoCat,
      dt_acidente: form.dt_acidente,
      hora_acidente: form.hora_acidente || null,
      cid: form.cid,
      natureza_lesao: form.natureza_lesao,
      parte_corpo: form.parte_corpo,
      agente_causador: form.agente_causador,
      descricao: form.descricao,
      houve_morte: form.houve_morte,
      dias_afastamento: form.dias_afastamento ? parseInt(form.dias_afastamento) : null,
      atendimento: { unidade: form.med_unidade, data: form.med_data, hora: form.med_hora, medico: form.med_medico, crm: form.med_crm },
      testemunhas: [],
    }).select().single()

    if (catErr) { setErro('Erro ao salvar: ' + catErr.message); setSalvando(false); return }

    await supabase.from('transmissoes').insert({
      empresa_id: empresaId,
      funcionario_id: form.funcionario_id,
      evento: 'S-2210',
      referencia_id: cat.id,
      referencia_tipo: 'cat',
      status: 'pendente',
      tentativas: 0,
      ambiente: 'producao_restrita',
    })

    setSucesso('CAT salva! Transmissão S-2210 criada como pendente.')
    setForm({ funcionario_id:'', dt_acidente:'', hora_acidente:'', cid:'', natureza_lesao:'', parte_corpo:'', agente_causador:'', descricao:'', houve_morte:false, dias_afastamento:'', med_unidade:'', med_data:'', med_hora:'', med_medico:'', med_crm:'' })
    setFuncSel(null); setTipoCat('')
    setSalvando(false)
    setAbaAtiva('lista')
    carregarCats(empresaId)
  }

  const inp = { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' }
  const lbl = { display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 }
  const card = { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }

  if (carregando) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' }}>Carregando...</div>

  const ST_COR: Record<string,[string,string]> = { enviado:['#EAF3DE','#27500A'], pendente:['#FAEEDA','#633806'], rejeitado:['#FCEBEB','#791F1F'] }

  return (
    <Layout pagina="s2210">
      <Head><title>S-2210 CAT — eSocial SST</title></Head>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'#111' }}>S-2210 — CAT</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Comunicação de Acidente de Trabalho</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ background:'#FCEBEB', color:'#791F1F', padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:600 }}>S-2210</span>
          <button onClick={() => setAbaAtiva('novo')} style={{ padding:'7px 14px', background:'#E24B4A', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>+ Nova CAT</button>
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
            {aba === 'lista' ? `Registros (${cats.length})` : 'Nova CAT'}
          </button>
        ))}
      </div>

      {sucesso && <div style={{ background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>{sucesso} <a href="/historico" style={{ color:'#085041', fontWeight:500 }}>Ver histórico →</a></div>}
      {erro && <div style={{ background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>{erro}</div>}

      {/* Lista de CATs */}
      {abaAtiva === 'lista' && (
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
          {cats.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af', fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
              Nenhuma CAT registrada ainda.
              <div style={{ marginTop:12 }}>
                <button onClick={() => setAbaAtiva('novo')} style={{ padding:'8px 16px', background:'#E24B4A', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Registrar primeira CAT</button>
              </div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f9fafb' }}>
                  {['Funcionário','Tipo','Data acidente','CID','Óbito','Status','Ações'].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'0.5px solid #e5e7eb', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cats.map((c: any) => {
                  const tx = Array.isArray(c.transmissoes) ? c.transmissoes[0] : c.transmissoes
                  const [stBg, stCor] = ST_COR[tx?.status] || ['#f3f4f6','#6b7280']
                  return (
                    <tr key={c.id} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ fontWeight:500, color:'#111' }}>{c.funcionarios?.nome || '—'}</div>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>{c.funcionarios?.matricula_esocial || ''}</div>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:600, background:'#FCEBEB', color:'#791F1F' }}>
                          {TIPO_LBL[c.tipo_cat as keyof typeof TIPO_LBL] || c.tipo_cat}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#374151' }}>
                        {c.dt_acidente ? new Date(c.dt_acidente+'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:12, fontFamily:'monospace', color:'#374151' }}>{c.cid || '—'}</td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>
                        {c.houve_morte ? <span style={{ color:'#E24B4A', fontWeight:700, fontSize:12 }}>Sim</span> : <span style={{ color:'#9ca3af', fontSize:12 }}>Não</span>}
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        {tx ? (
                          <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:stBg, color:stCor }}>
                            {tx.status === 'enviado' ? 'Enviado' : tx.status === 'pendente' ? 'Pendente' : 'Rejeitado'}
                          </span>
                        ) : <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>}
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
          <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:14 }}>Tipo de CAT</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {TIPOS_CAT.map(t => (
              <div key={t.v} onClick={() => setTipoCat(t.v)}
                style={{ padding:14, border: tipoCat===t.v ? '2px solid #E24B4A' : '1px solid #e5e7eb', borderRadius:10, cursor:'pointer', background: tipoCat===t.v ? '#FCEBEB' : '#fff', transition:'all .15s' }}>
                <div style={{ fontSize:13, fontWeight:600, color: tipoCat===t.v ? '#791F1F' : '#374151' }}>{t.l}</div>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:4, lineHeight:1.4 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:14 }}>Trabalhador acidentado</div>
          <div style={{ marginBottom:10 }}>
            <label style={lbl}>Selecionar funcionário *</label>
            <select style={inp} value={form.funcionario_id} onChange={e => selecionarFunc(e.target.value)} required>
              <option value="">Selecione o funcionário...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.matricula_esocial}</option>)}
            </select>
          </div>
          {funcSel && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#FCEBEB', borderRadius:8 }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:'#E24B4A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>
                {funcSel.nome.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{funcSel.nome}</div>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{funcSel.funcao} · {funcSel.setor} · {funcSel.matricula_esocial}</div>
              </div>
            </div>
          )}
        </div>

        {tipoCat && (
          <div style={card}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:14 }}>
              Dados do {TIPOS_CAT.find(t=>t.v===tipoCat)?.l}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div><label style={lbl}>Data do acidente *</label><input type="date" style={inp} value={form.dt_acidente} onChange={e=>setForm({...form,dt_acidente:e.target.value})} required /></div>
              <div><label style={lbl}>Hora do acidente</label><input type="time" style={inp} value={form.hora_acidente} onChange={e=>setForm({...form,hora_acidente:e.target.value})} /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div><label style={lbl}>CID-10 *</label><input style={inp} placeholder="Ex: S60.0" value={form.cid} onChange={e=>setForm({...form,cid:e.target.value})} required /></div>
              <div><label style={lbl}>Natureza da lesão</label>
                <select style={inp} value={form.natureza_lesao} onChange={e=>setForm({...form,natureza_lesao:e.target.value})}>
                  <option value="">Selecione...</option>
                  {['Corte / laceração','Contusão / esmagamento','Fratura','Queimadura','Luxação / entorse','Amputação','Intoxicação aguda','Outro'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div><label style={lbl}>Parte do corpo atingida</label>
                <select style={inp} value={form.parte_corpo} onChange={e=>setForm({...form,parte_corpo:e.target.value})}>
                  <option value="">Selecione...</option>
                  {['Cabeça','Olho(s)','Pescoço','Tronco','Ombro','Braço','Antebraço','Mão / dedos','Coluna vertebral','Quadril','Perna','Pé / dedos do pé','Múltiplas partes'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Agente causador</label>
                <select style={inp} value={form.agente_causador} onChange={e=>setForm({...form,agente_causador:e.target.value})}>
                  <option value="">Selecione...</option>
                  {['Máquinas e equipamentos','Ferramentas manuais','Veículo','Queda de nível','Queda de objeto','Agente químico','Esforço físico','Eletricidade','Outro'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={lbl}>Descrição detalhada do acidente</label>
              <textarea style={{...inp, minHeight:80, resize:'vertical', lineHeight:1.5}} placeholder="Descreva como ocorreu o acidente..." value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:16, alignItems:'center' }}>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#374151', cursor:'pointer' }}>
                <input type="checkbox" checked={form.houve_morte} onChange={e=>setForm({...form,houve_morte:e.target.checked})} />
                Houve óbito
              </label>
              <div><label style={lbl}>Dias de afastamento estimados</label>
                <input type="number" style={{...inp, maxWidth:160}} min="0" placeholder="0" value={form.dias_afastamento} onChange={e=>setForm({...form,dias_afastamento:e.target.value})} />
              </div>
            </div>
          </div>
        )}

        {tipoCat && (
          <div style={card}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:14 }}>Atendimento médico</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div><label style={lbl}>Unidade de atendimento</label><input style={inp} placeholder="UPA, Hospital..." value={form.med_unidade} onChange={e=>setForm({...form,med_unidade:e.target.value})} /></div>
              <div><label style={lbl}>Data do atendimento</label><input type="date" style={inp} value={form.med_data} onChange={e=>setForm({...form,med_data:e.target.value})} /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              <div><label style={lbl}>Hora</label><input type="time" style={inp} value={form.med_hora} onChange={e=>setForm({...form,med_hora:e.target.value})} /></div>
              <div><label style={lbl}>Médico assistente</label><input style={inp} placeholder="Nome" value={form.med_medico} onChange={e=>setForm({...form,med_medico:e.target.value})} /></div>
              <div><label style={lbl}>CRM</label><input style={inp} placeholder="CRM 12345-SP" value={form.med_crm} onChange={e=>setForm({...form,med_crm:e.target.value})} /></div>
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <button type="submit" disabled={salvando || !tipoCat} style={{ padding:'10px 20px', background:'#E24B4A', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity:(salvando||!tipoCat)?0.5:1 }}>
            {salvando ? 'Salvando...' : 'Salvar CAT'}
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
