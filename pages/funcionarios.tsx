import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { buscarCBO, type CBO } from '../lib/cbo'
import { getEmpresaId } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const formVazio = () => ({ nome:'', cpf:'', data_nasc:'', data_adm:'', matricula_esocial:'', funcao:'', cod_cbo:'', setor:'', vinculo:'CLT', turno:'Diurno' })

// Colunas do modelo de planilha

function gerarModeloCSV() {
  const header = 'Nome Completo *;CPF *;Data Nascimento (DD/MM/AAAA);Data Admissão (DD/MM/AAAA);Matrícula eSocial;Função/Cargo;Setor/GHE;Vínculo (CLT/PJ/Estatutário);Turno (Diurno/Noturno/Misto)'
  const ex1 = 'João Silva Santos;123.456.789-00;15/03/1990;01/06/2020;12345;Operador de Produção;Produção;CLT;Diurno'
  const ex2 = 'Maria Souza Lima;987.654.321-00;22/07/1985;15/02/2019;;Auxiliar Administrativo;Administrativo;CLT;Diurno'
  const blob = new Blob(['\uFEFF' + header + '\n' + ex1 + '\n' + ex2], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = 'modelo_funcionarios_esocial.csv'; a.click()
  URL.revokeObjectURL(url)
}

function parsarData(s) {
  if (!s || !s.trim()) return null
  if (s.includes('/')) {
    const [d,m,a] = s.split('/')
    if (a && m && d) return `${a.trim()}-${m.trim().padStart(2,'0')}-${d.trim().padStart(2,'0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return s.trim()
  return null
}

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
  // Importar planilha
  const [importando, setImportando] = useState(false)
  const [previewImport, setPreviewImport] = useState([])
  const [errosImport, setErrosImport] = useState([])
  const [mostrarImport, setMostrarImport] = useState(false)
  const [salvandoImport, setSalvandoImport] = useState(false)
  const [cboSugestoes, setCboSugestoes] = useState<CBO[]>([])
  const [cboAberto, setCboAberto] = useState(false)
  const cboRef = useRef<HTMLDivElement>(null)

  useEffect(() => { init() }, [])

  // Fecha dropdown CBO ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (cboRef.current && !cboRef.current.contains(e.target as Node)) setCboAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/login'); return }
    const empId = getEmpresaId() || user.empresa_id
    setEmpresaId(empId)
    await carregar(empId, '')
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
      funcao: f.funcao || '', cod_cbo: f.cod_cbo || '', setor: f.setor || '',
      vinculo: f.vinculo || 'CLT', turno: f.turno || 'Diurno',
    })
    setErro(''); setSucesso('')
    setMostrarForm(true)
    setTimeout(() => document.getElementById('campo-nome')?.focus(), 100)
  }

  function cancelar() { setMostrarForm(false); setFuncEditando(null); setForm(formVazio()); setErro('') }

  function validarCPF(cpf: string): boolean {
    const n = cpf.replace(/\D/g, '')
    if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false
    let s = 0
    for (let i = 0; i < 9; i++) s += parseInt(n[i]) * (10 - i)
    let r = (s * 10) % 11; if (r === 10 || r === 11) r = 0
    if (r !== parseInt(n[9])) return false
    s = 0
    for (let i = 0; i < 10; i++) s += parseInt(n[i]) * (11 - i)
    r = (s * 10) % 11; if (r === 10 || r === 11) r = 0
    return r === parseInt(n[10])
  }

  async function salvar(e) {
    e.preventDefault()
    setErro(''); setSucesso('')
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    if (!form.cpf.trim()) { setErro('CPF é obrigatório.'); return }
    if (!validarCPF(form.cpf)) { setErro('CPF inválido. Verifique os dígitos.'); return }

    const dados = {
      nome: form.nome.trim(),
      cpf: form.cpf.trim(),
      data_nasc: form.data_nasc || null,
      data_adm: form.data_adm || null,
      matricula_esocial: form.matricula_esocial.trim() || ('PEND-' + Date.now()),
      funcao: form.funcao.trim() || null,
      cod_cbo: form.cod_cbo.trim() || null,
      setor: form.setor.trim() || null,
      vinculo: form.vinculo,
      turno: form.turno,
    }

    if (funcEditando) {
      const { error } = await supabase.from('funcionarios').update(dados).eq('id', funcEditando.id)
      if (error) { setErro('Erro ao atualizar: ' + error.message); return }
      setSucesso(`${form.nome} atualizado com sucesso!`)
    } else {
      // Verificar se existe registro com mesmo CPF (pode estar inativo)
      const { data: existente } = await supabase
        .from('funcionarios')
        .select('id, ativo')
        .eq('empresa_id', empresaId)
        .eq('cpf', dados.cpf)
        .single()

      if (existente) {
        if (!existente.ativo) {
          // Reativar registro removido anteriormente
          const { error } = await supabase.from('funcionarios')
            .update({ ...dados, ativo: true }).eq('id', existente.id)
          if (error) { setErro('Erro ao reativar: ' + error.message); return }
          setSucesso(`${form.nome} reativado com sucesso!`)
        } else {
          setErro('CPF já cadastrado para outro funcionário ativo.')
          return
        }
      } else {
        const { error } = await supabase.from('funcionarios').insert({ ...dados, empresa_id: empresaId })
        if (error) { setErro(error.message.includes('unique') ? 'CPF ou matrícula já cadastrado.' : 'Erro: ' + error.message); return }
        setSucesso(`${form.nome} cadastrado com sucesso!`)
      }
    }

    setMostrarForm(false); setFuncEditando(null); setForm(formVazio())
    carregar(empresaId, busca)
  }

  async function desativar(id, nome) {
    if (!confirm(`Excluir ${nome} permanentemente? Todos os ASOs e transmissões vinculados também serão removidos.`)) return
    await supabase.from('funcionarios').delete().eq('id', id)
    carregar(empresaId, busca)
  }

  function lerPlanilha(file) {
    setImportando(true); setErrosImport([]); setPreviewImport([])
    const reader = new FileReader()
    reader.onload = (e) => {
      const texto = e.target.result
      const linhas = texto.split(/\r?\n/).filter(l => l.trim())
      if (linhas.length < 2) { setErrosImport(['Arquivo vazio ou sem dados.']); setImportando(false); return }
      const sep = linhas[0].includes(';') ? ';' : ','
      const header = linhas[0].split(sep).map(h => h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'_'))
      const idx = (termos) => { for (const t of termos) { const i = header.findIndex(h => h.includes(t)); if (i >= 0) return i } return -1 }
      const idxNome  = idx(['nome'])
      const idxCPF   = idx(['cpf'])
      const idxNasc  = idx(['nasc'])
      const idxAdm   = idx(['adm'])
      const idxMat   = idx(['matricula'])
      const idxFunc  = idx(['funcao','cargo'])
      const idxSetor = idx(['setor','ghe'])
      const idxVinc  = idx(['vinculo'])
      const idxTurno = idx(['turno'])
      if (idxNome < 0 || idxCPF < 0) { setErrosImport(['Colunas Nome e CPF são obrigatórias.']); setImportando(false); return }
      const erros = []
      const funcionarios = []
      linhas.slice(1).forEach((linha, i) => {
        if (!linha.trim()) return
        const cols = linha.split(sep).map(c => c.trim().replace(/^"|"$/g,''))
        const nome = idxNome >= 0 ? cols[idxNome] : ''
        const cpf  = idxCPF  >= 0 ? cols[idxCPF]  : ''
        if (!nome) { erros.push(`Linha ${i+2}: nome vazio`); return }
        if (!cpf)  { erros.push(`Linha ${i+2}: CPF vazio`);  return }
        funcionarios.push({
          nome, cpf: cpf.replace(/\D/g,'').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),
          data_nasc: parsarData(idxNasc  >= 0 ? cols[idxNasc]  : ''),
          data_adm:  parsarData(idxAdm   >= 0 ? cols[idxAdm]   : ''),
          matricula_esocial: idxMat >= 0 ? cols[idxMat] || null : null,
          funcao: idxFunc  >= 0 ? cols[idxFunc]  || null : null,
          setor:  idxSetor >= 0 ? cols[idxSetor] || null : null,
          vinculo: idxVinc >= 0 ? cols[idxVinc]  || 'CLT' : 'CLT',
          turno:   idxTurno >= 0 ? cols[idxTurno] || 'Diurno' : 'Diurno',
        })
      })
      setErrosImport(erros)
      setPreviewImport(funcionarios)
      setMostrarImport(true)
      setImportando(false)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function confirmarImport() {
    if (!previewImport.length) return
    setSalvandoImport(true); setErro(''); setSucesso('')
    let ok = 0; let fail = 0
    for (const func of previewImport) {
      const cpfLimpo = func.cpf.replace(/\D/g,'')
      const { data: existe } = await supabase.from('funcionarios').select('id').eq('empresa_id', empresaId).eq('cpf', func.cpf).single()
      if (existe) {
        const { error } = await supabase.from('funcionarios').update({
          nome: func.nome, data_nasc: func.data_nasc, data_adm: func.data_adm,
          matricula_esocial: func.matricula_esocial || ('AUTO-' + cpfLimpo.slice(-6)),
          funcao: func.funcao, setor: func.setor, vinculo: func.vinculo, turno: func.turno,
        }).eq('id', existe.id)
        error ? fail++ : ok++
      } else {
        const { error } = await supabase.from('funcionarios').insert({
          empresa_id: empresaId, ativo: true,
          nome: func.nome, cpf: func.cpf,
          data_nasc: func.data_nasc, data_adm: func.data_adm,
          matricula_esocial: func.matricula_esocial || ('AUTO-' + cpfLimpo.slice(-6)),
          funcao: func.funcao, setor: func.setor, vinculo: func.vinculo, turno: func.turno,
        })
        error ? fail++ : ok++
      }
    }
    setSucesso(`${ok} funcionário(s) importado(s).${fail > 0 ? ` ${fail} com erro.` : ''}`)
    setMostrarImport(false); setPreviewImport([]); setSalvandoImport(false)
    carregar(empresaId, busca)
  }

  function fmtCPF(v) {
    return v.replace(/\D/g,'').substring(0,11)
      .replace(/(\d{3})(\d)/,'$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/,'$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/,'$1.$2.$3-$4')
  }

  const dadosIncompletos = (f) =>
    !f.data_adm || !f.data_nasc || !f.cod_cbo ||
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
          <button style={s.btnOutline} onClick={gerarModeloCSV}>⬇ Baixar modelo</button>
          <label style={{ ...s.btnOutline, cursor:'pointer', display:'inline-flex', alignItems:'center' }}>
            ↑ Importar planilha
            <input type="file" accept=".csv,.xlsx" style={{ display:'none' }}
              onChange={e => e.target.files[0] && lerPlanilha(e.target.files[0])} />
          </label>
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
              <div style={s.field} ref={cboRef}>
                <label style={s.label}>Função / Cargo <span style={s.opcLabel}>(CBO)</span></label>
                <div style={{ position:'relative' }}>
                  <input style={s.input} placeholder="Digite para buscar ou escreva livremente..."
                    value={form.funcao}
                    onChange={e => {
                      const v = e.target.value
                      setForm({...form, funcao: v, cod_cbo: ''})
                      const sugs = buscarCBO(v)
                      setCboSugestoes(sugs)
                      setCboAberto(sugs.length > 0)
                    }}
                    onFocus={() => { if (cboSugestoes.length > 0) setCboAberto(true) }}
                    onBlur={() => {
                      setTimeout(() => {
                        setCboAberto(false)
                        if (form.funcao.trim() && !form.cod_cbo) {
                          const sugs = buscarCBO(form.funcao)
                          if (sugs.length === 1) {
                            setForm(prev => ({ ...prev, cod_cbo: sugs[0].codigo, funcao: sugs[0].nome }))
                          }
                        }
                      }, 150)
                    }}
                  />
                  {cboAberto && cboSugestoes.length > 0 && (
                    <div style={{ position:'absolute', top:'calc(100% + 2px)', left:0, right:0, background:'#fff', border:'1px solid #d1d5db', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.1)', zIndex:200, overflow:'hidden' }}>
                      {cboSugestoes.map(c => (
                        <button key={c.codigo} type="button"
                          onClick={() => { setForm({...form, funcao: c.nome, cod_cbo: c.codigo}); setCboAberto(false) }}
                          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', border:'none', background:'transparent', cursor:'pointer', textAlign:'left', fontSize:12 }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f5f9ff')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ color:'#111' }}>{c.nome}</span>
                          <span style={{ fontSize:11, color:'#185FA5', fontFamily:'monospace', fontWeight:600, flexShrink:0, marginLeft:8 }}>{c.codigo}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.funcao.trim() && (
                  form.cod_cbo
                    ? <div style={{ marginTop:4, display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
                        <span style={{ background:'#E6F1FB', color:'#185FA5', fontWeight:700, fontFamily:'monospace', padding:'2px 8px', borderRadius:99 }}>{form.cod_cbo}</span>
                        <span style={{ color:'#6b7280' }}>CBO vinculado</span>
                      </div>
                    : <div style={{ marginTop:4, display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#92400e' }}>
                        <span>⚠</span>
                        <span>CBO não vinculado — selecione da lista para vincular o código</span>
                      </div>
                )}
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
                  <td style={s.td}>
                    <div>{f.funcao || <span style={{ color:'#d1d5db' }}>—</span>}</div>
                    {f.cod_cbo
                      ? <span style={{ fontSize:10, fontWeight:700, fontFamily:'monospace', color:'#185FA5', background:'#E6F1FB', padding:'1px 6px', borderRadius:99 }}>{f.cod_cbo}</span>
                      : f.funcao ? <span style={{ fontSize:10, color:'#92400e' }}>⚠ sem CBO</span> : null
                    }
                  </td>
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
      {/* Modal importar planilha */}
      {mostrarImport && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={() => setMostrarImport(false)}>
          <div style={{ background:'var(--color-background-primary,#fff)', borderRadius:14, padding:'1.5rem', width:640, maxHeight:'85vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:15, fontWeight:600, color:'#111' }}>
                ↑ Importar planilha — {previewImport.length} funcionário(s)
              </div>
              <button onClick={() => setMostrarImport(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9ca3af' }}>×</button>
            </div>

            {errosImport.length > 0 && (
              <div style={{ background:'#FCEBEB', border:'0.5px solid #F09595', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#791F1F', marginBottom:12 }}>
                <strong>{errosImport.length} aviso(s):</strong>
                {errosImport.slice(0,5).map((e,i) => <div key={i}>• {e}</div>)}
                {errosImport.length > 5 && <div>+{errosImport.length-5} mais...</div>}
              </div>
            )}

            {previewImport.length > 0 && (
              <div style={{ background:'#EAF3DE', border:'0.5px solid #C0DD97', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#27500A', marginBottom:12 }}>
                ✓ {previewImport.length} funcionário(s) prontos para importar. Existentes serão atualizados, novos serão criados.
              </div>
            )}

            <div style={{ border:'0.5px solid #e5e7eb', borderRadius:8, overflow:'hidden', marginBottom:14 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#f9fafb' }}>
                    {['Nome','CPF','Nascimento','Admissão','Matrícula','Função/Cargo','Setor'].map(h => (
                      <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:10, fontWeight:600, color:'#9ca3af', borderBottom:'0.5px solid #e5e7eb', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewImport.slice(0,10).map((f,i) => (
                    <tr key={i} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                      <td style={{ padding:'7px 10px', fontWeight:500 }}>{f.nome}</td>
                      <td style={{ padding:'7px 10px', color:'#6b7280' }}>{f.cpf}</td>
                      <td style={{ padding:'7px 10px', color:'#6b7280' }}>{f.data_nasc||'—'}</td>
                      <td style={{ padding:'7px 10px', color:'#6b7280' }}>{f.data_adm||'—'}</td>
                      <td style={{ padding:'7px 10px', color:'#6b7280', fontFamily:'monospace', fontSize:11 }}>{f.matricula_esocial||'—'}</td>
                      <td style={{ padding:'7px 10px', color:'#374151' }}>{f.funcao||'—'}</td>
                      <td style={{ padding:'7px 10px', color:'#374151' }}>{f.setor||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewImport.length > 10 && (
                <div style={{ padding:'8px 12px', fontSize:11, color:'#9ca3af', background:'#f9fafb', textAlign:'center' }}>
                  +{previewImport.length-10} funcionário(s) não exibidos
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button style={s.btnPrimary} onClick={confirmarImport} disabled={salvandoImport || !previewImport.length}>
                {salvandoImport ? 'Importando...' : `Confirmar importação (${previewImport.length})`}
              </button>
              <button style={s.btnOutline} onClick={() => setMostrarImport(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
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
