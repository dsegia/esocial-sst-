import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TIPOS = [
  { v: 'admissional', l: 'Admissional' },
  { v: 'periodico', l: 'Periódico' },
  { v: 'retorno', l: 'Retorno ao trabalho' },
  { v: 'mudanca', l: 'Mudança de função' },
  { v: 'demissional', l: 'Demissional' },
  { v: 'monitoracao', l: 'Monitoração pontual' },
]

export default function S2220() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [funcionarios, setFuncionarios] = useState([])
  const [funcSel, setFuncSel] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')
  const [exames, setExames] = useState([
    { nome: 'Hemograma completo', resultado: 'Normal' },
    { nome: 'Acuidade visual', resultado: 'Normal' },
  ])
  const [novoExame, setNovoExame] = useState('')
  const [novoResult, setNovoResult] = useState('Normal')
  const [form, setForm] = useState({
    funcionario_id: '',
    tipo_aso: 'periodico',
    data_exame: '',
    prox_exame: '',
    conclusao: 'apto',
    medico_nome: '',
    medico_crm: '',
  })

  useEffect(() => { init() }, [])
  useEffect(() => {
    if (router.query.func) setForm(f => ({ ...f, funcionario_id: router.query.func }))
  }, [router.query])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresaId(user.empresa_id)
    const { data: funcs } = await supabase.from('funcionarios').select('id,nome,cpf,matricula_esocial,setor,funcao').eq('empresa_id', user.empresa_id).eq('ativo', true).order('nome')
    setFuncionarios(funcs || [])
    setCarregando(false)
  }

  function selecionarFunc(id) {
    setForm(f => ({ ...f, funcionario_id: id }))
    setFuncSel(funcionarios.find(x => x.id === id) || null)
  }

  function addExame() {
    if (!novoExame.trim()) return
    setExames([...exames, { nome: novoExame.trim(), resultado: novoResult }])
    setNovoExame('')
  }

  function remExame(i) { setExames(exames.filter((_, idx) => idx !== i)) }

  function updResult(i, v) { const a = [...exames]; a[i].resultado = v; setExames(a) }

  async function salvar(e) {
    e.preventDefault(); setErro(''); setSucesso(''); setSalvando(true)
    if (!form.funcionario_id) { setErro('Selecione o funcionário.'); setSalvando(false); return }
    if (!form.data_exame) { setErro('Informe a data do exame.'); setSalvando(false); return }
    if (exames.length === 0) { setErro('Adicione ao menos um exame.'); setSalvando(false); return }

    const { data: aso, error: asoErr } = await supabase.from('asos').insert({
      funcionario_id: form.funcionario_id,
      empresa_id: empresaId,
      tipo_aso: form.tipo_aso,
      data_exame: form.data_exame,
      prox_exame: form.prox_exame || null,
      conclusao: form.conclusao,
      medico_nome: form.medico_nome,
      medico_crm: form.medico_crm,
      exames: exames,
      riscos: [],
    }).select().single()

    if (asoErr) { setErro('Erro ao salvar: ' + asoErr.message); setSalvando(false); return }

    await supabase.from('transmissoes').insert({
      empresa_id: empresaId,
      funcionario_id: form.funcionario_id,
      evento: 'S-2220',
      referencia_id: aso.id,
      referencia_tipo: 'aso',
      status: 'pendente',
      tentativas: 0,
      ambiente: 'producao_restrita',
    })

    setSucesso('ASO salvo! Transmissão criada como pendente.')
    setForm({ funcionario_id: '', tipo_aso: 'periodico', data_exame: '', prox_exame: '', conclusao: 'apto', medico_nome: '', medico_crm: '' })
    setFuncSel(null)
    setExames([{ nome: 'Hemograma completo', resultado: 'Normal' }])
    setSalvando(false)
  }

  if (carregando) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' }}>Carregando...</div>

  const temAlterado = exames.some(e => e.resultado === 'Alterado')
  const precisaS2240 = ['admissional','periodico','mudanca'].includes(form.tipo_aso)

  return (
    <Layout pagina="s2220">
      <Head><title>S-2220 ASO — eSocial SST</title></Head>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'#111' }}>S-2220 — ASO</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Atestado de Saúde Ocupacional · NR-7</div>
        </div>
        <span style={{ background:'#E6F1FB', color:'#0C447C', padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:600 }}>S-2220</span>
      </div>

      {sucesso && <div style={{ background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>{sucesso} <a href="/historico" style={{ color:'#085041', fontWeight:500 }}>Ver histórico →</a></div>}
      {erro && <div style={{ background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>{erro}</div>}

      <form onSubmit={salvar}>
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:14 }}>Trabalhador</div>
          <div style={{ marginBottom:10 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 }}>Selecionar funcionário *</label>
            <select style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', fontFamily:'inherit' }}
              value={form.funcionario_id} onChange={e => selecionarFunc(e.target.value)} required>
              <option value="">Selecione o funcionário...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.matricula_esocial}</option>)}
            </select>
          </div>
          {funcSel && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#EAF3DE', borderRadius:8 }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:'#1D9E75', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>
                {funcSel.nome.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{funcSel.nome}</div>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{funcSel.funcao} · {funcSel.setor} · {funcSel.matricula_esocial}</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:14 }}>Dados do ASO</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 }}>Tipo de exame *</label>
              <select style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', fontFamily:'inherit' }}
                value={form.tipo_aso} onChange={e => setForm({ ...form, tipo_aso: e.target.value })}>
                {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 }}>Data do exame *</label>
              <input type="date" style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box' }}
                value={form.data_exame} onChange={e => setForm({ ...form, data_exame: e.target.value })} required />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 }}>Próximo exame</label>
              <input type="date" style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box' }}
                value={form.prox_exame} onChange={e => setForm({ ...form, prox_exame: e.target.value })} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 }}>Conclusão *</label>
              <select style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', fontFamily:'inherit' }}
                value={form.conclusao} onChange={e => setForm({ ...form, conclusao: e.target.value })}>
                <option value="apto">Apto</option>
                <option value="inapto">Inapto</option>
                <option value="apto_restricao">Apto com restrição</option>
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 }}>Médico responsável</label>
              <input style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' }}
                placeholder="Nome do médico" value={form.medico_nome} onChange={e => setForm({ ...form, medico_nome: e.target.value })} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 }}>CRM</label>
              <input style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' }}
                placeholder="CRM 12345-SP" value={form.medico_crm} onChange={e => setForm({ ...form, medico_crm: e.target.value })} />
            </div>
          </div>
        </div>

        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:14 }}>Exames realizados</div>
          {exames.map((ex, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'0.5px solid #f3f4f6' }}>
              <span style={{ flex:1, fontSize:13, color:'#374151' }}>{ex.nome}</span>
              <select style={{ padding:'5px 8px', fontSize:12, border:'1px solid #d1d5db', borderRadius:6, background:'#fff', color:'#111', fontFamily:'inherit' }}
                value={ex.resultado} onChange={e => updResult(i, e.target.value)}>
                <option>Normal</option><option>Alterado</option><option>Pendente</option>
              </select>
              {ex.resultado === 'Alterado' && <span style={{ fontSize:10, background:'#FCEBEB', color:'#791F1F', padding:'2px 7px', borderRadius:99, fontWeight:600 }}>!</span>}
              <button type="button" onClick={() => remExame(i)} style={{ background:'none', border:'none', color:'#9ca3af', fontSize:18, cursor:'pointer', padding:'0 2px' }}>×</button>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <input style={{ flex:1, padding:'7px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, fontFamily:'inherit', color:'#111' }}
              placeholder="Nome do exame..." value={novoExame} onChange={e => setNovoExame(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();addExame()} }} />
            <select style={{ padding:'7px 10px', fontSize:12, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', fontFamily:'inherit' }}
              value={novoResult} onChange={e => setNovoResult(e.target.value)}>
              <option>Normal</option><option>Alterado</option><option>Pendente</option>
            </select>
            <button type="button" onClick={addExame} style={{ padding:'7px 14px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer' }}>+ Add</button>
          </div>
          {temAlterado && <div style={{ background:'#FAEEDA', color:'#633806', border:'0.5px solid #FAC775', borderRadius:8, padding:'8px 12px', fontSize:12, marginTop:10 }}>Exame alterado detectado — verifique necessidade de CAT (S-2210).</div>}
          {precisaS2240 && <div style={{ background:'#E6F1FB', color:'#0C447C', border:'0.5px solid #B5D4F4', borderRadius:8, padding:'8px 12px', fontSize:12, marginTop:8 }}>Tipo <strong>{TIPOS.find(t=>t.v===form.tipo_aso)?.l}</strong> — certifique-se de que o S-2240 (LTCAT) está atualizado antes de transmitir.</div>}
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button type="submit" disabled={salvando} style={{ padding:'10px 20px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity:salvando?0.7:1 }}>
            {salvando ? 'Salvando...' : 'Salvar ASO'}
          </button>
          <button type="button" onClick={() => router.push('/historico')} style={{ padding:'10px 20px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, color:'#374151', cursor:'pointer' }}>
            Ver histórico
          </button>
        </div>
      </form>
    </Layout>
  )
}
