import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const formVazio = () => ({ nome:'', cpf:'', data_nasc:'', data_adm:'', matricula_esocial:'', funcao:'', setor:'', vinculo:'CLT', turno:'Diurno' })

export default function Funcionarios() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [lista, setLista] = useState([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [funcEditando, setFuncEditando] = useState(null)
  const [form, setForm] = useState(formVazio())
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresaId(user.empresa_id)
    await carregar(user.empresa_id, '')
    setCarregando(false)
  }

  async function carregar(eId, q) {
    let query = supabase.from('funcionarios').select('*').eq('empresa_id', eId).eq('ativo', true).order('nome')
    if (q) query = query.or(`nome.ilike.%${q}%,cpf.ilike.%${q}%,matricula_esocial.ilike.%${q}%`)
    const { data } = await query
    setLista(data || [])
  }

  function abrirNovo() {
    setFuncEditando(null)
    setForm(formVazio())
    setErro(''); setSucesso('')
    setMostrarForm(true)
    setTimeout(() => document.getElementById('campo-nome')?.focus(), 100)
  }

  function abrirEditar(f) {
    setFuncEditando(f)
    setForm({
      nome: f.nome || '', cpf: f.cpf || '',
      data_nasc: f.data_nasc || '', data_adm: f.data_adm || '',
      matricula_esocial: (f.matricula_esocial?.startsWith('PEND-') || f.matricula_esocial?.startsWith('AUTO-')) ? '' : (f.matricula_esocial || ''),
      funcao: f.funcao || '', setor: f.setor || '',
      vinculo: f.vinculo || 'CLT', turno: f.turno || 'Diurno',
    })
    setErro(''); setSucesso('')
    setMostrarForm(true)
    setTimeout(() => document.getElementById('campo-nome')?.focus(), 100)
  }

  function cancelar() { setMostrarForm(false); setFuncEditando(null); setForm(formVazio()); setErro('') }

  async function salvar(e) {
    e.preventDefault()
    setErro(''); setSucesso('')
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    if (!form.cpf.trim()) { setErro('CPF é obrigatório.'); return }

    const dados = {
      nome: form.nome.trim(),
      cpf: form.cpf.trim(),
      data_nasc: form.data_nasc || null,
      data_adm: form.data_adm || null,
      matricula_esocial: form.matricula_esocial.trim() || ('PEND-' + Date.now()),
      funcao: form.funcao.trim() || null,
      setor: form.setor.trim() || null,
      vinculo: form.vinculo,
      turno: form.turno,
    }

    if (funcEditando) {
      const { error } = await supabase.from('funcionarios').update(dados).eq('id', funcEditando.id)
      if (error) { setErro('Erro ao atualizar: ' + error.message); return }
      setSucesso(`${form.nome} atualizado com sucesso!`)
    } else {
      const { error } = await supabase.from('funcionarios').insert({ ...dados, empresa_id: empresaId })
      if (error) { setErro(error.message.includes('unique') ? 'CPF ou matrícula já cadastrado.' : 'Erro: ' + error.message); return }
      setSucesso(`${form.nome} cadastrado com sucesso!`)
    }

    setMostrarForm(false); setFuncEditando(null); setForm(formVazio())
    carregar(empresaId, busca)
  }

  async function desativar(id, nome) {
    if (!confirm(`Remover ${nome} do sistema?`)) return
    await supabase.from('funcionarios').update({ ativo: false }).eq('id', id)
    carregar(empresaId, busca)
  }

  function fmtCPF(v) {
    return v.replace(/\D/g,'').substring(0,11)
      .replace(/(\d{3})(\d)/,'$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/,'$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/,'$1.$2.$3-$4')
  }

  const dadosIncompletos = (f) =>
    !f.data_adm || !f.data_nasc ||
    !f.matricula_esocial || f.matricula_esocial.startsWith('PEND-') || f.matricula_esocial.startsWith('AUTO-')

  if (carregando) return <div style={s.loading}>Carregando...</div>

  return (
    <Layout pagina="funcionarios">
      <Head><title>Funcionários — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>Funcionários</div>
          <div style={s.sub}>{lista.length} cadastrado(s) · {lista.filter(dadosIncompletos).length} com dados incompletos</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input style={s.busca} placeholder="Buscar nome, CPF ou matrícula..."
            value={busca} onChange={e => { setBusca(e.target.value); carregar(empresaId, e.target.value) }} />
          <button style={s.btnPrimary} onClick={abrirNovo}>+ Adicionar</button>
        </div>
      </div>

      {sucesso && <div style={s.sucessoBox}>{sucesso}</div>}

      {mostrarForm && (
        <div style={s.formCard}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={s.cardTitulo}>{funcEditando ? `Editando — ${funcEditando.nome}` : 'Novo funcionário'}</div>
            <button onClick={cancelar} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9ca3af', lineHeight:1 }}>×</button>
          </div>

          <div style={{ background:'#E6F1FB', border:'0.5px solid #B5D4F4', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#0C447C', marginBottom:14 }}>
            Nome e CPF são obrigatórios. Admissão, nascimento e matrícula podem ser preenchidos depois — são exigidos apenas na transmissão ao Gov.br.
          </div>

          <form onSubmit={salvar}>
            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Nome completo *</label>
                <input id="campo-nome" style={s.input} value={form.nome} onChange={e => setForm({...form, nome:e.target.value})} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>CPF *</label>
                <input style={s.input} value={form.cpf} onChange={e => setForm({...form, cpf:fmtCPF(e.target.value)})} required />
              </div>
            </div>
            <div style={s.row3}>
              <div style={s.field}>
                <label style={s.label}>Nascimento <span style={s.opcLabel}>(opcional)</span></label>
                <input style={s.input} type="date" value={form.data_nasc} onChange={e => setForm({...form, data_nasc:e.target.value})} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Admissão <span style={s.opcLabel}>(opcional)</span></label>
                <input style={s.input} type="date" value={form.data_adm} onChange={e => setForm({...form, data_adm:e.target.value})} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Matrícula eSocial <span style={s.opcLabel}>(opcional)</span></label>
                <input style={s.input} placeholder="Gerada automaticamente se vazia" value={form.matricula_esocial} onChange={e => setForm({...form, matricula_esocial:e.target.value})} />
              </div>
            </div>
            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Função / Cargo</label>
                <input style={s.input} value={form.funcao} onChange={e => setForm({...form, funcao:e.target.value})} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Setor / GHE</label>
                <input style={s.input} value={form.setor} onChange={e => setForm({...form, setor:e.target.value})} />
              </div>
            </div>
            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Vínculo</label>
                <select style={s.input} value={form.vinculo} onChange={e => setForm({...form, vinculo:e.target.value})}>
                  <option>CLT</option><option>Temporário</option><option>Aprendiz</option><option>Estagiário</option>
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Turno</label>
                <select style={s.input} value={form.turno} onChange={e => setForm({...form, turno:e.target.value})}>
                  <option>Diurno</option><option>Vespertino</option><option>Noturno</option><option>Misto / 12x36</option>
                </select>
              </div>
            </div>
            {erro && <div style={s.erroBox}>{erro}</div>}
            <div style={{ display:'flex', gap:8 }}>
              <button type="submit" style={s.btnPrimary}>{funcEditando ? 'Salvar alterações' : 'Cadastrar funcionário'}</button>
              <button type="button" onClick={cancelar} style={s.btnOutline}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div style={s.tabela}>
        <table style={s.table}>
          <thead>
            <tr style={s.thead}>
              {['Nome','CPF','Admissão','Função','Setor','Matrícula','Ações'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:'2rem', color:'#9ca3af', fontSize:13 }}>
                {busca ? 'Nenhum resultado.' : 'Nenhum funcionário cadastrado.'}
              </td></tr>
            ) : lista.map(f => {
              const incompleto = dadosIncompletos(f)
              return (
                <tr key={f.id} style={s.tr}>
                  <td style={s.td}>
                    <div style={{ fontWeight:500, color:'#111' }}>{f.nome}</div>
                    {incompleto && (
                      <div style={{ fontSize:10, color:'#EF9F27', marginTop:2, display:'flex', alignItems:'center', gap:3 }}>
                        ⚠ Completar dados para transmissão
                      </div>
                    )}
                  </td>
                  <td style={{ ...s.td, fontFamily:'monospace', fontSize:12 }}>{f.cpf}</td>
                  <td style={s.td}>{f.data_adm ? new Date(f.data_adm+'T12:00:00').toLocaleDateString('pt-BR') : <span style={{ color:'#d1d5db' }}>—</span>}</td>
                  <td style={s.td}>{f.funcao || <span style={{ color:'#d1d5db' }}>—</span>}</td>
                  <td style={s.td}>{f.setor || <span style={{ color:'#d1d5db' }}>—</span>}</td>
                  <td style={s.td}>
                    <span style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:500,
                      background: incompleto ? '#FAEEDA' : '#EAF3DE',
                      color: incompleto ? '#633806' : '#27500A' }}>
                      {(f.matricula_esocial?.startsWith('PEND-') || f.matricula_esocial?.startsWith('AUTO-')) ? 'Pendente' : (f.matricula_esocial || 'Pendente')}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }} onClick={() => abrirEditar(f)}>Editar</button>
                      <button style={s.btnAcao} onClick={() => router.push(`/s2220?func=${f.id}`)}>ASO</button>
                      <button style={{ ...s.btnAcao, color:'#791F1F', borderColor:'#F09595' }} onClick={() => desativar(f.id, f.nome)}>Remover</button>
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
  header:     { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' },
  titulo:     { fontSize:20, fontWeight:700, color:'#111' },
  sub:        { fontSize:12, color:'#6b7280', marginTop:2 },
  busca:      { padding:'8px 12px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, width:280, fontFamily:'inherit', outline:'none' },
  btnPrimary: { padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnOutline: { padding:'8px 16px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', color:'#374151' },
  btnAcao:    { padding:'3px 10px', fontSize:11, background:'transparent', border:'0.5px solid #d1d5db', borderRadius:6, cursor:'pointer', color:'#374151' },
  sucessoBox: { background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  formCard:   { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' },
  cardTitulo: { fontSize:14, fontWeight:600, color:'#111' },
  row2:       { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
  row3:       { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 },
  field:      {},
  label:      { display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 },
  opcLabel:   { fontWeight:400, color:'#9ca3af', fontSize:11 },
  input:      { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit', outline:'none' },
  erroBox:    { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  tabela:     { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' },
  table:      { width:'100%', borderCollapse:'collapse', fontSize:13 },
  thead:      { background:'#f9fafb' },
  th:         { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'0.5px solid #e5e7eb', textTransform:'uppercase', letterSpacing:'.04em' },
  tr:         { borderBottom:'0.5px solid #f3f4f6' },
  td:         { padding:'10px 12px', color:'#374151', verticalAlign:'top' },
}
