import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { pdfPCMSO } from '../lib/gerarPDF'
import { getEmpresaId } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Exames padrão por tipo de risco (NR-7)
const EXAMES_POR_RISCO = {
  fis: ['Audiometria tonal','Espirometria','Acuidade visual','Avaliação clínica'],
  qui: ['Hemograma completo','Avaliação clínica','Espirometria','Exame toxicológico'],
  bio: ['Hemograma completo','Avaliação clínica','Sorologia hepatite B'],
  erg: ['Avaliação clínica','Avaliação psicossocial','Rx coluna lombar'],
}

const PERIODICIDADES = ['Anual','Semestral','Bienal','Admissional','Demissional','Retorno','Mudança de função']

const EXAMES_COMUNS = [
  'Avaliação clínica','Hemograma completo','Glicemia de jejum','Urina rotina',
  'Audiometria tonal','Acuidade visual','Espirometria','Eletrocardiograma (ECG)',
  'Eletroencefalograma (EEG)','Rx Tórax PA OIT','Rx Coluna L/S','Avaliação psicossocial',
  'Tipagem sanguínea','Colesterol total e frações','Triglicérides','TGO/TGP',
  'Teste de Romberg','Avaliação dermatológica','Sorologia hepatite B','Exame toxicológico',
]

export default function PCMSO() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpjEmpresa, setCnpjEmpresa] = useState('')
  const [funcionarios, setFuncionarios] = useState([])
  const [ltcatAtivo, setLtcatAtivo] = useState(null)
  const [asos, setAsos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState('programa') // programa | funcionarios | novo
  const [filtroSetor, setFiltroSetor] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  // Programa PCMSO
  const [programa, setPrograma] = useState([])
  const [editandoFunc, setEditandoFunc] = useState(null)
  const [formFunc, setFormFunc] = useState({
    funcao: '', setor: '', riscos: [], exames: []
  })
  const [novoExame, setNovoExame] = useState({ nome:'', periodicidade:'Anual', obrigatorio:true })
  const [salvandoProg, setSalvandoProg] = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    const { data:{ session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data:user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    const empId = getEmpresaId() || user.empresa_id
    setEmpresaId(empId)
    supabase.from('empresas').select('razao_social,cnpj').eq('id', empId).single()
      .then(({ data: emp }) => { if (emp) { setNomeEmpresa(emp.razao_social); setCnpjEmpresa(emp.cnpj) } })

    const [funcsRes, ltcatRes, asosRes, progRes] = await Promise.all([
      supabase.from('funcionarios').select('id,nome,cpf,funcao,setor,matricula_esocial').eq('empresa_id', empId).eq('ativo',true).order('nome'),
      supabase.from('ltcats').select('*').eq('empresa_id', empId).eq('ativo',true).order('data_emissao',{ascending:false}).limit(1).single(),
      supabase.from('asos').select('funcionario_id,tipo_aso,data_exame,prox_exame,conclusao,exames').eq('empresa_id', empId).order('data_exame',{ascending:false}),
      supabase.from('pcmso_programa').select('*').eq('empresa_id', empId).order('funcao'),
    ])

    setFuncionarios(funcsRes.data || [])
    setLtcatAtivo(ltcatRes.data || null)
    setAsos(asosRes.data || [])
    setPrograma(progRes.data || [])
    setCarregando(false)
  }

  function ultimoAso(funcId) {
    return asos.filter(a => a.funcionario_id === funcId).sort((a,b) => new Date(b.data_exame)-new Date(a.data_exame))[0] || null
  }

  function statusAso(aso) {
    if (!aso) return { label:'Sem ASO', cor:'#E24B4A', bg:'#FCEBEB' }
    if (!aso.prox_exame) return { label:'Sem próximo exame', cor:'#EF9F27', bg:'#FAEEDA' }
    const dias = Math.round((new Date(aso.prox_exame) - new Date()) / 86400000)
    if (dias < 0) return { label:`Vencido há ${Math.abs(dias)}d`, cor:'#E24B4A', bg:'#FCEBEB' }
    if (dias <= 30) return { label:`Vence em ${dias}d`, cor:'#E24B4A', bg:'#FCEBEB' }
    if (dias <= 60) return { label:`Vence em ${dias}d`, cor:'#EF9F27', bg:'#FAEEDA' }
    return { label:'Em dia', cor:'#1D9E75', bg:'#EAF3DE' }
  }

  function agentesDoFuncionario(func) {
    if (!ltcatAtivo?.ghes) return []
    for (const ghe of ltcatAtivo.ghes) {
      const setorGHE = (ghe.setor||'').toLowerCase()
      const setorFunc = (func.setor||'').toLowerCase()
      if (setorGHE && setorFunc && (setorGHE.includes(setorFunc) || setorFunc.includes(setorGHE))) {
        return ghe.agentes || []
      }
    }
    return []
  }

  function examesRecomendados(agentes) {
    const set = new Set(['Avaliação clínica'])
    agentes.forEach(ag => (EXAMES_POR_RISCO[ag.tipo]||[]).forEach(e => set.add(e)))
    return [...set]
  }

  // Abrir formulário de novo programa para função
  function abrirNovoPrograma(func) {
    const agentes = agentesDoFuncionario(func)
    const examesRec = examesRecomendados(agentes)
    const progExistente = programa.find(p => p.funcao === func.funcao && p.setor === func.setor)

    setEditandoFunc(func)
    setFormFunc({
      funcao: func.funcao || '',
      setor: func.setor || '',
      riscos: agentes.map(a => a.nome),
      exames: progExistente?.exames || examesRec.map(e => ({ nome:e, periodicidade:'Anual', obrigatorio:true }))
    })
    setAba('novo')
  }

  function addExame() {
    if (!novoExame.nome) return
    setFormFunc(p => ({ ...p, exames: [...p.exames, { ...novoExame }] }))
    setNovoExame({ nome:'', periodicidade:'Anual', obrigatorio:true })
  }

  function removerExame(i) {
    setFormFunc(p => ({ ...p, exames: p.exames.filter((_,idx) => idx!==i) }))
  }

  async function salvarPrograma() {
    if (!formFunc.funcao) { setErro('Informe a função.'); return }
    if (!formFunc.exames.length) { setErro('Adicione ao menos um exame.'); return }
    setSalvandoProg(true); setErro(''); setSucesso('')

    const dados = {
      empresa_id: empresaId,
      funcao: formFunc.funcao,
      setor: formFunc.setor,
      riscos: formFunc.riscos,
      exames: formFunc.exames,
      atualizado_em: new Date().toISOString(),
    }

    // Verificar se já existe
    const existente = programa.find(p => p.funcao === formFunc.funcao && p.setor === formFunc.setor)
    let error
    if (existente) {
      ;({ error } = await supabase.from('pcmso_programa').update(dados).eq('id', existente.id))
    } else {
      ;({ error } = await supabase.from('pcmso_programa').insert(dados))
    }

    if (error) { setErro('Erro ao salvar: ' + error.message) }
    else {
      setSucesso(`Programa salvo para ${formFunc.funcao}!`)
      await init()
      setAba('programa')
    }
    setSalvandoProg(false)
  }

  async function excluirPrograma(id) {
    if (!confirm('Excluir este programa?')) return
    await supabase.from('pcmso_programa').delete().eq('id', id)
    init()
  }

  const setores = [...new Set(funcionarios.map(f => f.setor).filter(Boolean))]
  const funcsFiltradas = filtroSetor ? funcionarios.filter(f => f.setor === filtroSetor) : funcionarios
  const totalEmDia = funcionarios.filter(f => statusAso(ultimoAso(f.id)).label === 'Em dia').length
  const conformidade = funcionarios.length > 0 ? Math.round((totalEmDia/funcionarios.length)*100) : 100

  if (carregando) return <div style={s.loading}>Carregando...</div>

  return (
    <Layout pagina="pcmso">
      <Head><title>PCMSO — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>PCMSO</div>
          <div style={s.sub}>Programa de Controle Médico de Saúde Ocupacional · NR-7</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button style={s.btnOutline} onClick={() => {
            const medico = ltcatAtivo?.resp_nome || ''
            const crm    = ltcatAtivo?.resp_registro || ''
            pdfPCMSO(nomeEmpresa, cnpjEmpresa, medico, crm, programa)
          }}>📄 Exportar PDF</button>
          <button style={s.btnOutline} onClick={() => router.push('/leitor?tipo=pcmso')}>↑ Importar PDF / XML</button>
          <button style={s.btnPrimary} onClick={() => {
            setEditandoFunc(null)
            setFormFunc({ funcao:'', setor:'', riscos:[], exames:[] })
            setAba('novo')
          }}>+ Novo manual</button>
        </div>
      </div>

      {sucesso && <div style={s.sucessoBox}>{sucesso}</div>}
      {erro    && <div style={s.erroBox}>{erro}</div>}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:'1.25rem' }}>
        {[
          { n: funcionarios.length,  l:'Funcionários',   c:'#185FA5' },
          { n: conformidade+'%',     l:'ASOs em dia',    c: conformidade<80?'#E24B4A':'#1D9E75' },
          { n: programa.length,      l:'Programas por função', c:'#185FA5' },
          { n: ltcatAtivo?'Vigente':'Ausente', l:'LTCAT', c: ltcatAtivo?'#1D9E75':'#E24B4A' },
        ].map((k,i) => (
          <div key={i} style={s.kpiCard}>
            <div style={{ fontSize:22, fontWeight:700, color:k.c }}>{k.n}</div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display:'flex', gap:4, borderBottom:'0.5px solid #e5e7eb', marginBottom:16 }}>
        {[
          { k:'programa', l:`Programas por função (${programa.length})` },
          { k:'funcionarios', l:`Monitoramento (${funcionarios.length})` },
        ].map(ab => (
          <button key={ab.k} onClick={() => setAba(ab.k)} style={{
            padding:'8px 16px', fontSize:13, fontWeight: aba===ab.k?600:400,
            background:'transparent', border:'none', cursor:'pointer',
            borderBottom: aba===ab.k?'2px solid #185FA5':'2px solid transparent',
            color: aba===ab.k?'#185FA5':'#6b7280',
          }}>{ab.l}</button>
        ))}
      </div>

      {/* ABA: Programas por função */}
      {aba === 'programa' && (
        <div>
          {programa.length === 0 ? (
            <div style={{ ...s.card, textAlign:'center', padding:'3rem' }}>
              <div style={{ fontSize:14, color:'#374151', marginBottom:8 }}>Nenhum programa cadastrado</div>
              <div style={{ fontSize:12, color:'#9ca3af', marginBottom:16 }}>
                Defina os exames obrigatórios por função/setor
              </div>
              <button style={s.btnPrimary} onClick={() => { setFormFunc({funcao:'',setor:'',riscos:[],exames:[]}); setAba('novo') }}>
                + Criar primeiro programa
              </button>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {programa.map(prog => (
                <div key={prog.id} style={s.card}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:'#111' }}>{prog.funcao}</div>
                      {prog.setor && <div style={{ fontSize:11, color:'#6b7280' }}>Setor: {prog.setor}</div>}
                    </div>
                    <div style={{ display:'flex', gap:5 }}>
                      <button style={s.btnAcao} onClick={() => {
                        setEditandoFunc({ funcao:prog.funcao, setor:prog.setor })
                        setFormFunc({ funcao:prog.funcao, setor:prog.setor, riscos:prog.riscos||[], exames:prog.exames||[] })
                        setAba('novo')
                      }}>Editar</button>
                      <button style={{ ...s.btnAcao, color:'#E24B4A', borderColor:'#F09595' }}
                        onClick={() => excluirPrograma(prog.id)}>Excluir</button>
                    </div>
                  </div>

                  {/* Riscos */}
                  {prog.riscos?.length > 0 && (
                    <div style={{ marginBottom:10 }}>
                      <div style={s.secLabel}>Riscos</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {prog.riscos.slice(0,3).map((r,i) => (
                          <span key={i} style={{ padding:'2px 8px', borderRadius:99, fontSize:10, background:'#FAEEDA', color:'#633806' }}>{r}</span>
                        ))}
                        {prog.riscos.length > 3 && <span style={{ fontSize:10, color:'#9ca3af' }}>+{prog.riscos.length-3}</span>}
                      </div>
                    </div>
                  )}

                  {/* Exames */}
                  <div>
                    <div style={s.secLabel}>Exames obrigatórios ({prog.exames?.length || 0})</div>
                    {(prog.exames||[]).slice(0,4).map((ex,i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#374151', padding:'3px 0', borderBottom:'0.5px solid #f3f4f6' }}>
                        <span>• {ex.nome}</span>
                        <span style={{ color:'#9ca3af', fontSize:11 }}>{ex.periodicidade}</span>
                      </div>
                    ))}
                    {(prog.exames||[]).length > 4 && (
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>+{prog.exames.length-4} exames</div>
                    )}
                  </div>

                  <div style={{ marginTop:10, fontSize:11, color:'#6b7280' }}>
                    {funcionarios.filter(f => f.funcao === prog.funcao).length} funcionário(s) com esta função
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA: Monitoramento por funcionário */}
      {aba === 'funcionarios' && (
        <div>
          <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
            <button onClick={() => setFiltroSetor('')} style={{ ...s.filtroBtn, background:!filtroSetor?'#185FA5':'#f3f4f6', color:!filtroSetor?'#fff':'#374151' }}>
              Todos ({funcionarios.length})
            </button>
            {setores.map(st => (
              <button key={st} onClick={() => setFiltroSetor(st)} style={{ ...s.filtroBtn, background:filtroSetor===st?'#185FA5':'#f3f4f6', color:filtroSetor===st?'#fff':'#374151' }}>
                {st} ({funcionarios.filter(f=>f.setor===st).length})
              </button>
            ))}
          </div>

          <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
            <table style={s.table}>
              <thead>
                <tr style={{ background:'#f9fafb' }}>
                  {['Funcionário','Função / Setor','Programa PCMSO','Último ASO','Próximo exame','Status','Ação'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funcsFiltradas.map(f => {
                  const aso = ultimoAso(f.id)
                  const st = statusAso(aso)
                  const prog = programa.find(p => p.funcao === f.funcao && (!p.setor || p.setor === f.setor))
                    || programa.find(p => p.funcao === f.funcao)
                  const agentes = agentesDoFuncionario(f)
                  return (
                    <tr key={f.id} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                      <td style={s.td}>
                        <div style={{ fontWeight:500 }}>{f.nome}</div>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>{f.matricula_esocial}</div>
                      </td>
                      <td style={s.td}>
                        <div style={{ fontSize:13 }}>{f.funcao || '—'}</div>
                        <div style={{ fontSize:11, color:'#6b7280' }}>{f.setor || '—'}</div>
                      </td>
                      <td style={s.td}>
                        {prog ? (
                          <div>
                            <span style={{ fontSize:11, color:'#1D9E75', fontWeight:500 }}>✓ {prog.exames?.length} exames definidos</span>
                            <div style={{ fontSize:10, color:'#9ca3af' }}>
                              {prog.exames?.slice(0,2).map(e=>e.nome).join(', ')}{prog.exames?.length>2?'...':''}
                            </div>
                          </div>
                        ) : (
                          <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4', fontSize:11 }}
                            onClick={() => abrirNovoPrograma(f)}>
                            + Criar programa
                          </button>
                        )}
                      </td>
                      <td style={s.td}>
                        {aso ? (
                          <div style={{ fontSize:12 }}>
                            {new Date(aso.data_exame+'T12:00:00').toLocaleDateString('pt-BR')}
                            <div style={{ fontSize:10, color:'#9ca3af' }}>{aso.tipo_aso}</div>
                          </div>
                        ) : <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>}
                      </td>
                      <td style={s.td}>
                        {aso?.prox_exame
                          ? <span style={{ fontSize:12 }}>{new Date(aso.prox_exame+'T12:00:00').toLocaleDateString('pt-BR')}</span>
                          : <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>}
                      </td>
                      <td style={s.td}>
                        <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:st.bg, color:st.cor }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={s.td}>
                        <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }}
                          onClick={() => router.push(`/s2220?func=${f.id}`)}>
                          {aso ? 'Novo ASO' : 'Agendar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA: Novo/Editar programa */}
      {aba === 'novo' && (
        <div style={s.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={s.cardTit}>
              {editandoFunc ? `Editar programa — ${formFunc.funcao}` : 'Novo programa de exames'}
            </div>
            <button onClick={() => setAba('programa')} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9ca3af' }}>×</button>
          </div>

          <div style={s.row2}>
            <div>
              <label style={s.label}>Função / Cargo *</label>
              <input style={s.input} placeholder="Ex: Operador de Produção"
                value={formFunc.funcao} onChange={e => setFormFunc({...formFunc, funcao:e.target.value})} />
            </div>
            <div>
              <label style={s.label}>Setor / GHE</label>
              <input style={s.input} placeholder="Ex: Produção, Administrativo"
                value={formFunc.setor} onChange={e => setFormFunc({...formFunc, setor:e.target.value})} />
            </div>
          </div>

          {/* Riscos vinculados */}
          {ltcatAtivo && (
            <div style={{ marginBottom:14 }}>
              <label style={s.label}>Riscos vinculados (do LTCAT — automático)</label>
              {formFunc.riscos.length > 0 ? (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {formFunc.riscos.map((r,i) => (
                    <span key={i} style={{ padding:'3px 10px', borderRadius:99, fontSize:11, background:'#FAEEDA', color:'#633806' }}>
                      {r}
                      <button onClick={() => setFormFunc(p=>({...p, riscos:p.riscos.filter((_,idx)=>idx!==i)}))}
                        style={{ marginLeft:6, background:'none', border:'none', cursor:'pointer', color:'#633806', fontSize:12 }}>×</button>
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize:12, color:'#9ca3af' }}>Nenhum risco vinculado. Preencha o setor para vincular ao LTCAT automaticamente.</div>
              )}
            </div>
          )}

          {/* Exames */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <label style={s.label}>Exames obrigatórios ({formFunc.exames.length})</label>
            </div>

            {formFunc.exames.map((ex,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'0.5px solid #f3f4f6' }}>
                <div style={{ flex:1, fontSize:13 }}>{ex.nome}</div>
                <select style={{ ...s.input, width:130 }} value={ex.periodicidade}
                  onChange={e => setFormFunc(p=>({...p, exames:p.exames.map((x,idx)=>idx===i?{...x,periodicidade:e.target.value}:x)}))}>
                  {PERIODICIDADES.map(p => <option key={p}>{p}</option>)}
                </select>
                <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>
                  <input type="checkbox" checked={ex.obrigatorio}
                    onChange={e => setFormFunc(p=>({...p, exames:p.exames.map((x,idx)=>idx===i?{...x,obrigatorio:e.target.checked}:x)}))}/>
                  Obrigatório
                </label>
                <button onClick={() => removerExame(i)} style={{ background:'none', border:'none', color:'#E24B4A', cursor:'pointer', fontSize:18 }}>×</button>
              </div>
            ))}

            {/* Adicionar exame */}
            <div style={{ marginTop:10, padding:'12px', background:'#f9fafb', borderRadius:8 }}>
              <div style={{ fontSize:12, fontWeight:500, color:'#374151', marginBottom:8 }}>Adicionar exame</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <input style={s.input} list="exames-list" placeholder="Nome do exame..."
                    value={novoExame.nome} onChange={e => setNovoExame({...novoExame, nome:e.target.value})}
                    onKeyDown={e => e.key==='Enter' && (e.preventDefault(), addExame())} />
                  <datalist id="exames-list">
                    {EXAMES_COMUNS.map(e => <option key={e} value={e}/>)}
                  </datalist>
                </div>
                <select style={{ ...s.input, width:130 }} value={novoExame.periodicidade}
                  onChange={e => setNovoExame({...novoExame, periodicidade:e.target.value})}>
                  {PERIODICIDADES.map(p => <option key={p}>{p}</option>)}
                </select>
                <button style={s.btnOutline} onClick={addExame}>+ Adicionar</button>
              </div>
              {/* Sugestões rápidas */}
              <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:4 }}>
                {EXAMES_COMUNS.filter(e => !formFunc.exames.find(ex=>ex.nome===e)).slice(0,6).map(e => (
                  <button key={e} onClick={() => {
                    setFormFunc(p => ({ ...p, exames: [...p.exames, { nome:e, periodicidade:'Anual', obrigatorio:true }] }))
                  }} style={{ padding:'2px 8px', fontSize:11, background:'#E6F1FB', color:'#0C447C', border:'none', borderRadius:99, cursor:'pointer' }}>
                    + {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {erro && <div style={s.erroBox}>{erro}</div>}

          <div style={{ display:'flex', gap:8 }}>
            <button style={s.btnPrimary} onClick={salvarPrograma} disabled={salvandoProg}>
              {salvandoProg ? 'Salvando...' : 'Salvar programa'}
            </button>
            <button style={s.btnOutline} onClick={() => setAba('programa')}>Cancelar</button>
          </div>
        </div>
      )}
    </Layout>
  )
}

const s = {
  loading:    { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' },
  header:     { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' },
  titulo:     { fontSize:20, fontWeight:700, color:'#111' },
  sub:        { fontSize:12, color:'#6b7280', marginTop:2 },
  kpiCard:    { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1rem' },
  card:       { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' },
  cardTit:    { fontSize:13, fontWeight:600, color:'#111' },
  secLabel:   { fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 },
  row2:       { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 },
  label:      { display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 },
  input:      { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' },
  table:      { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:         { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'0.5px solid #e5e7eb', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' },
  td:         { padding:'10px 12px', verticalAlign:'middle', color:'#374151' },
  filtroBtn:  { padding:'5px 12px', fontSize:11, fontWeight:500, borderRadius:99, cursor:'pointer', border:'none' },
  btnAcao:    { padding:'3px 10px', fontSize:11, background:'transparent', border:'0.5px solid #d1d5db', borderRadius:6, cursor:'pointer', color:'#374151' },
  btnPrimary: { padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnOutline: { padding:'8px 14px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', color:'#374151' },
  erroBox:    { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  sucessoBox: { background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
}
