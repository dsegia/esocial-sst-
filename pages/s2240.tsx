import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { getEmpresaId } from '../lib/empresa'

// Tabela 27 eSocial — exames
const EXAMES_ESOCIAL = [
  { codigo: '001', nome: 'Acuidade visual' },
  { codigo: '002', nome: 'Audiometria tonal e vocal' },
  { codigo: '003', nome: 'Eletrocardiograma (ECG)' },
  { codigo: '004', nome: 'Eletroencefalograma (EEG)' },
  { codigo: '005', nome: 'Espirometria' },
  { codigo: '006', nome: 'Exame clínico' },
  { codigo: '007', nome: 'Hemograma completo' },
  { codigo: '008', nome: 'Glicemia em jejum' },
  { codigo: '009', nome: 'Colesterol total e frações' },
  { codigo: '010', nome: 'Triglicerídeos' },
  { codigo: '011', nome: 'Ureia' },
  { codigo: '012', nome: 'Creatinina' },
  { codigo: '013', nome: 'Transaminases (TGO/TGP)' },
  { codigo: '014', nome: 'Gama-GT' },
  { codigo: '018', nome: 'Urina tipo I (EAS)' },
  { codigo: '020', nome: 'Radiografia de tórax' },
  { codigo: '021', nome: 'Avaliação psicológica' },
  { codigo: '031', nome: 'Chumbo no sangue (plumbemia)' },
  { codigo: '032', nome: 'Mercúrio na urina' },
  { codigo: '033', nome: 'Benzeno no sangue' },
  { codigo: '034', nome: 'Colinesterase eritrocitária' },
  { codigo: '099', nome: 'Outros' },
]

function codigoDeExame(nome: string): string {
  const n = nome.toLowerCase()
  const match = EXAMES_ESOCIAL.find(e =>
    n.includes(e.nome.toLowerCase().split(' ')[0]) ||
    e.nome.toLowerCase().includes(n.split(' ')[0])
  )
  return match?.codigo || '099'
}

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
  // Mapear GHE
  const [mapeandoFunc, setMapeandoFunc] = useState(null)
  // Editar funcionário
  const [editandoFunc, setEditandoFunc] = useState(null)
  const [confirmExcluirTx, setConfirmExcluirTx] = useState(null)
  const [confirmExcluirFunc, setConfirmExcluirFunc] = useState(null)
  const [formEdit, setFormEdit] = useState({})
  const [salvandoEdit, setSalvandoEdit] = useState(false)
  const [gheSelecionado, setGheSelecionado] = useState('')
  // Exames no modal de edição
  const [abaModal, setAbaModal] = useState<'dados'|'exames'>('dados')
  const [asoDoFunc, setAsoDoFunc] = useState<any>(null)
  const [formExames, setFormExames] = useState<any[]>([])
  const [novoExameCodigo, setNovoExameCodigo] = useState(EXAMES_ESOCIAL[0].codigo)
  const [novoExameResultado, setNovoExameResultado] = useState<'Normal'|'Alterado'|'Pendente'>('Normal')
  const [asos, setAsos] = useState<any[]>([])

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    const empId = getEmpresaId() || user.empresa_id
    setEmpresaId(empId)

    const [funcsRes, ltcatRes, txRes, asosRes] = await Promise.all([
      supabase.from('funcionarios').select('id,nome,cpf,matricula_esocial,funcao,setor,data_adm,data_nasc,ghe_id').eq('empresa_id', empId).eq('ativo', true).order('nome'),
      supabase.from('ltcats').select('*').eq('empresa_id', empId).eq('ativo', true).order('data_emissao', { ascending: false }).limit(1).single(),
      supabase.from('transmissoes').select('id,status,evento,funcionario_id,recibo,dt_envio,criado_em,erro_descricao').eq('empresa_id', empId).eq('evento', 'S-2240').order('criado_em', { ascending: false }),
      supabase.from('asos').select('id,funcionario_id,tipo_aso,data_exame,exames').eq('empresa_id', empId).order('data_exame', { ascending: false }),
    ])

    setFuncionarios(funcsRes.data || [])
    setLtcatAtivo(ltcatRes.data || null)
    setTransmissoes(txRes.data || [])
    setAsos(asosRes.data || [])
    setCarregando(false)
  }

  function ultimaTx(funcId) {
    return transmissoes.filter(t => t.funcionario_id === funcId)[0] || null
  }

  function ultimoAsoFunc(funcId) {
    return asos.filter(a => a.funcionario_id === funcId)
      .sort((a, b) => new Date(b.data_exame).getTime() - new Date(a.data_exame).getTime())[0] || null
  }

  function abrirEditar(f: any) {
    const aso = ultimoAsoFunc(f.id)
    setAsoDoFunc(aso)
    const exames = (aso?.exames || []).map((e: any) => ({
      ...e,
      codigo: e.codigo || codigoDeExame(e.nome),
    }))
    setFormExames(exames)
    setNovoExameCodigo(EXAMES_ESOCIAL[0].codigo)
    setNovoExameResultado('Normal')
    setAbaModal('dados')
    setFormEdit({
      nome: f.nome || '', cpf: f.cpf || '',
      data_nasc: f.data_nasc || '', data_adm: f.data_adm || '',
      matricula_esocial: f.matricula_esocial?.startsWith('PEND-') ? '' : (f.matricula_esocial || ''),
      funcao: f.funcao || '', setor: f.setor || '',
    })
    setEditandoFunc(f)
    setSucesso(''); setErro('')
  }

  async function salvarExames() {
    if (!asoDoFunc) return
    setSalvandoEdit(true)
    const { error } = await supabase.from('asos').update({ exames: formExames }).eq('id', asoDoFunc.id)
    if (error) setErro('Erro ao salvar exames: ' + error.message)
    else { setSucesso('Exames atualizados!'); await init() }
    setSalvandoEdit(false)
  }

  function adicionarExame() {
    const item = EXAMES_ESOCIAL.find(e => e.codigo === novoExameCodigo)
    if (!item) return
    if (formExames.some(e => e.codigo === novoExameCodigo)) { setErro('Exame já adicionado.'); return }
    setFormExames(prev => [...prev, { codigo: item.codigo, nome: item.nome, resultado: novoExameResultado }])
    setErro('')
  }

  function removerExame(idx: number) {
    setFormExames(prev => prev.filter((_, i) => i !== idx))
  }

  function atualizarResultado(idx: number, resultado: string) {
    setFormExames(prev => prev.map((e, i) => i === idx ? { ...e, resultado } : e))
  }

  function gheDoFuncionario(func) {
    if (!ltcatAtivo?.ghes) return null

    // 1. GHE fixado manualmente (ghe_id salvo no funcionário)
    if (func.ghe_id !== undefined && func.ghe_id !== null) {
      return ltcatAtivo.ghes[func.ghe_id] || null
    }

    // 2. Cargo/Função do funcionário bate com funcoes cadastradas no GHE
    if (func.funcao) {
      const fnLow = func.funcao.toLowerCase().trim()
      for (const ghe of ltcatAtivo.ghes) {
        const fnsGhe = (ghe.funcoes || []).map(f => f.toLowerCase().trim())
        // Verifica correspondência parcial em ambas as direções
        if (fnsGhe.some(f =>
          f.includes(fnLow) || fnLow.includes(f) ||
          // Verifica palavras principais (ignora preposições)
          fnLow.split(' ').filter(w=>w.length>3).some(w => f.includes(w))
        )) return ghe
      }
    }

    // 3. Cruzamento por setor
    if (func.setor) {
      for (const ghe of ltcatAtivo.ghes) {
        const sg = (ghe.setor||'').toLowerCase()
        const sf = func.setor.toLowerCase()
        if (sg && sf && (sg.includes(sf) || sf.includes(sg))) return ghe
      }
    }

    // 4. Se só tem 1 GHE, assume que é dele
    if (ltcatAtivo.ghes.length === 1) return ltcatAtivo.ghes[0]

    return null
  }

  // Índice do GHE para o funcionário (para salvar no banco)
  function idxGheDoFuncionario(func) {
    const ghe = gheDoFuncionario(func)
    if (!ghe || !ltcatAtivo?.ghes) return null
    return ltcatAtivo.ghes.indexOf(ghe)
  }

  function statusFuncionario(func) {
    const tx  = ultimaTx(func.id)
    const ghe = gheDoFuncionario(func)
    const dadosOk = func.data_adm && func.data_nasc && func.matricula_esocial && !func.matricula_esocial.startsWith('PEND-')

    if (!ltcatAtivo) return { label:'Sem LTCAT', cor:'#E24B4A', bg:'#FCEBEB', pode:false, motivo:'Nenhum LTCAT ativo' }
    if (!dadosOk)    return { label:'Dados incompletos', cor:'#EF9F27', bg:'#FAEEDA', pode:false, motivo:'Faltam admissão, nascimento ou matrícula eSocial' }
    if (!ghe)        return { label:'GHE não vinculado', cor:'#EF9F27', bg:'#FAEEDA', pode:false, motivo:'Clique em "Vincular GHE" para associar' }

    if (!tx) return { label:'Não transmitido', cor:'#EF9F27', bg:'#FAEEDA', pode:true, motivo:'Clique em "Criar S-2240" para registrar' }
    if (tx.status === 'enviado')   return { label:'Transmitido', cor:'#1D9E75', bg:'#EAF3DE', pode:false, motivo:`Recibo: ${tx.recibo||'—'}` }
    if (tx.status === 'pendente')  return { label:'Pendente', cor:'#EF9F27', bg:'#FAEEDA', pode:true, motivo:'Aguardando transmissão' }
    if (tx.status === 'rejeitado') return { label:'Rejeitado', cor:'#E24B4A', bg:'#FCEBEB', pode:true, motivo:tx.erro_descricao||'Verifique o erro' }
    return { label:'Em dia', cor:'#1D9E75', bg:'#EAF3DE', pode:false, motivo:'' }
  }

  async function vincularGHE(func) {
    if (gheSelecionado === '') { setErro('Selecione um GHE.'); return }
    const idx = parseInt(gheSelecionado)
    const { error } = await supabase.from('funcionarios').update({ ghe_id: idx }).eq('id', func.id)
    if (error) { setErro('Erro ao vincular: ' + error.message); return }
    setSucesso(`GHE "${ltcatAtivo.ghes[idx]?.nome||'GHE '+(idx+1)}" vinculado a ${func.nome}.`)
    setMapeandoFunc(null); setGheSelecionado('')
    init()
  }

  async function criarTransmissao(funcId) {
    const { error } = await supabase.from('transmissoes').insert({
      empresa_id: empresaId, funcionario_id: funcId,
      evento: 'S-2240', referencia_id: ltcatAtivo.id, referencia_tipo: 'ltcat',
      status: 'pendente', tentativas: 0, ambiente: 'producao_restrita',
    })
    if (error) { setErro('Erro: ' + error.message); return }
    setSucesso('Transmissão S-2240 criada.')
    init()
  }

  async function salvarEdicaoFunc() {
    setSalvandoEdit(true)
    const { error } = await supabase.from('funcionarios').update({
      nome:              formEdit.nome,
      cpf:               formEdit.cpf,
      data_nasc:         formEdit.data_nasc || null,
      data_adm:          formEdit.data_adm  || null,
      matricula_esocial: formEdit.matricula_esocial || ('PEND-' + Date.now()),
      funcao:            formEdit.funcao || null,
      setor:             formEdit.setor  || null,
    }).eq('id', editandoFunc.id)
    if (error) { setErro('Erro: ' + error.message) }
    else { setSucesso('Funcionário atualizado!'); setEditandoFunc(null); init() }
    setSalvandoEdit(false)
  }

  async function excluirFuncionario(funcId) {
    const { error } = await supabase.from('funcionarios').update({ ativo: false }).eq('id', funcId)
    if (error) { setErro('Erro: ' + error.message); return }
    setSucesso('Funcionário removido da lista.')
    setConfirmExcluirFunc(null)
    init()
  }

  async function excluirTransmissao(txId) {
    const { error } = await supabase.from('transmissoes').delete().eq('id', txId)
    if (error) { setErro('Erro ao excluir: ' + error.message); return }
    setSucesso('Transmissão excluída.')
    setConfirmExcluirTx(null)
    init()
  }

  async function criarParaTodos() {
    const aptos = funcsFiltradas.filter(f => statusFuncionario(f).label === 'Não transmitido')
    for (const f of aptos) await criarTransmissao(f.id)
    setSucesso(`${aptos.length} transmissão(ões) criada(s). Acesse "Ir para transmissão" para enviar.`)
  }

  const funcsFiltradas = funcionarios.filter(f => {
    const st = statusFuncionario(f)
    if (filtro === 'todos') return true
    if (filtro === 'pendente') return st.pode
    if (filtro === 'ok') return st.label === 'Transmitido'
    if (filtro === 'problema') return ['Sem LTCAT','Dados incompletos','Rejeitado','GHE não vinculado'].includes(st.label)
    return true
  })

  const prontos   = funcionarios.filter(f => statusFuncionario(f).pode)
  const problemas = funcionarios.filter(f => ['Sem LTCAT','Dados incompletos','Rejeitado','GHE não vinculado'].includes(statusFuncionario(f).label))

  if (carregando) return <div style={s.loading}>Carregando...</div>

  return (
    <Layout pagina="s2240">
      <Head><title>S-2240 — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>S-2240 — Condições Ambientais do Trabalho</div>
          <div style={s.sub}>{prontos.length} pendente(s) · {problemas.length} com problema</div>
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
            ✓ LTCAT ativo · emitido em <strong>{new Date(ltcatAtivo.data_emissao+'T12:00:00').toLocaleDateString('pt-BR')}</strong>
            · {ltcatAtivo.ghes?.length||0} GHE(s) · Resp: {ltcatAtivo.resp_nome||'—'}
          </div>
          <button style={{ ...s.btnOutline, padding:'4px 10px', fontSize:12 }} onClick={() => router.push('/ltcat')}>Editar LTCAT →</button>
        </div>
      ) : (
        <div style={{ background:'#FCEBEB', border:'1px solid #E24B4A', borderRadius:10, padding:'12px 16px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:13, color:'#791F1F' }}>⚠ Nenhum LTCAT ativo. Necessário para o S-2240.</div>
          <button style={s.btnPrimary} onClick={() => router.push('/ltcat')}>Cadastrar LTCAT →</button>
        </div>
      )}

      {/* Ação em massa */}
      {prontos.filter(f=>statusFuncionario(f).label==='Não transmitido').length > 0 && (
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:13, color:'#374151' }}>
            <strong style={{ color:'#EF9F27' }}>{prontos.filter(f=>statusFuncionario(f).label==='Não transmitido').length}</strong> funcionário(s) prontos para ter S-2240 criado
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button style={s.btnOutline} onClick={criarParaTodos}>Criar S-2240 para todos</button>
            <button style={s.btnPrimary} onClick={() => router.push('/transmissao-manual')}>📡 Ir para transmissão</button>
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

      {/* Modal vincular GHE */}
      {mapeandoFunc && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ fontSize:14, fontWeight:600, color:'#111', marginBottom:6 }}>
              Vincular GHE — {mapeandoFunc.nome}
            </div>
            <div style={{ fontSize:12, color:'#6b7280', marginBottom:14, lineHeight:1.6 }}>
              Selecione o GHE do LTCAT que corresponde à função/setor deste funcionário.
              Isso define os agentes de risco e a necessidade de aposentadoria especial.
            </div>
            <label style={s.label}>GHE do LTCAT</label>
            <select style={{ ...s.input, marginBottom:14 }} value={gheSelecionado} onChange={e => setGheSelecionado(e.target.value)}>
              <option value="">— selecione —</option>
              {(ltcatAtivo?.ghes||[]).map((g,i) => (
                <option key={i} value={i}>
                  {g.nome||`GHE ${i+1}`}
                  {g.setor ? ` — ${g.setor}` : ''}
                  {g.funcoes?.length ? ` · Funções: ${g.funcoes.slice(0,2).join(', ')}${g.funcoes.length>2?'...':''}` : ''}
                  {` (${g.agentes?.length||0} agentes)`}
                </option>
              ))}
            </select>
            {gheSelecionado !== '' && ltcatAtivo?.ghes[parseInt(gheSelecionado)] && (
              <div style={{ background:'#f9fafb', borderRadius:8, padding:'10px 12px', marginBottom:12, fontSize:12, color:'#374151' }}>
                <div style={{ fontWeight:600, marginBottom:6, color:'#111' }}>
                  {ltcatAtivo.ghes[parseInt(gheSelecionado)].nome}
                  {ltcatAtivo.ghes[parseInt(gheSelecionado)].setor && (
                    <span style={{ fontWeight:400, color:'#6b7280' }}> · {ltcatAtivo.ghes[parseInt(gheSelecionado)].setor}</span>
                  )}
                </div>
                {(ltcatAtivo.ghes[parseInt(gheSelecionado)].funcoes||[]).length > 0 && (
                  <div style={{ marginBottom:6 }}>
                    <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', marginBottom:3 }}>Funções cadastradas</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {ltcatAtivo.ghes[parseInt(gheSelecionado)].funcoes.map((fn,i) => (
                        <span key={i} style={{ padding:'1px 7px', borderRadius:99, fontSize:11, background:'#E6F1FB', color:'#0C447C' }}>{fn}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ color:'#6b7280', marginBottom:4 }}>
                  <strong>Agentes:</strong> {(ltcatAtivo.ghes[parseInt(gheSelecionado)].agentes||[]).slice(0,3).map(a=>a.nome).join(', ')}
                  {(ltcatAtivo.ghes[parseInt(gheSelecionado)].agentes||[]).length > 3 && ` +${ltcatAtivo.ghes[parseInt(gheSelecionado)].agentes.length-3}`}
                </div>
                {ltcatAtivo.ghes[parseInt(gheSelecionado)].aposentadoria_especial && (
                  <div style={{ color:'#791F1F', fontWeight:500 }}>⚠ Aposentadoria especial — direito à aposentadoria reduzida</div>
                )}
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button style={s.btnPrimary} onClick={() => vincularGHE(mapeandoFunc)} disabled={gheSelecionado===''}>Vincular GHE</button>
              <button style={s.btnOutline} onClick={() => { setMapeandoFunc(null); setGheSelecionado('') }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f9fafb' }}>
              {['Funcionário','Função / Cargo · Setor','GHE vinculado','Agentes de risco','Última transmissão','Status','Ações'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funcsFiltradas.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:'2rem', color:'#9ca3af', fontSize:13 }}>Nenhum resultado.</td></tr>
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
                        <div style={{ fontSize:12, fontWeight:500, color:'#111' }}>{ghe.nome||'—'}</div>
                        <div style={{ fontSize:11, color:'#6b7280' }}>{ghe.setor||'—'} · {ghe.qtd_trabalhadores||'?'} trab.</div>
                        {ghe.aposentadoria_especial && <span style={{ fontSize:10, color:'#791F1F', fontWeight:600 }}>⚠ Aposent. especial</span>}
                      </div>
                    ) : (
                      <span style={{ fontSize:11, color:'#EF9F27' }}>Não vinculado</span>
                    )}
                  </td>
                  <td style={s.td}>
                    {(() => {
                      const agentes = ghe?.agentes || []
                      if (!ghe) return <span style={{ fontSize:11, color:'#9ca3af' }}>Vincule um GHE</span>
                      if (agentes.length === 0) return <span style={{ fontSize:11, color:'#EF9F27' }}>GHE sem agentes cadastrados</span>
                      const COR: any = { fis:'#E6F1FB', qui:'#FAEEDA', bio:'#EAF3DE', erg:'#FCEBEB' }
                      const TXT: any = { fis:'#0C447C', qui:'#633806', bio:'#27500A', erg:'#791F1F' }
                      const TIPO: any = { fis:'Físico', qui:'Químico', bio:'Biológico', erg:'Ergonômico' }
                      return (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                          {agentes.slice(0,3).map((ag: any, i: number) => (
                            <span key={i} title={`${TIPO[ag.tipo]||ag.tipo} — ${ag.nome}`}
                              style={{ padding:'1px 6px', borderRadius:99, fontSize:10, fontWeight:500,
                                background: COR[ag.tipo]||'#f3f4f6', color: TXT[ag.tipo]||'#374151' }}>
                              {ag.nome?.substring(0,18)}{ag.nome?.length > 18 ? '…' : ''}
                            </span>
                          ))}
                          {agentes.length > 3 && (
                            <span style={{ fontSize:10, color:'#9ca3af' }}>+{agentes.length-3}</span>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td style={s.td}>
                    {tx ? (
                      <div>
                        <div style={{ fontSize:11 }}>{new Date(tx.criado_em).toLocaleDateString('pt-BR')}</div>
                        <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>{tx.recibo ? tx.recibo.substring(0,12)+'...' : '—'}</div>
                      </div>
                    ) : <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>}
                  </td>
                  <td style={s.td}>
                    <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:st.bg, color:st.cor }}>
                      {st.label}
                    </span>
                    {st.motivo && <div style={{ fontSize:10, color:'#9ca3af', marginTop:3, maxWidth:160 }}>{st.motivo}</div>}
                  </td>
                  <td style={s.td}>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {/* Vincular GHE */}
                      {!ghe && ltcatAtivo && (
                        <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }}
                          onClick={() => { setMapeandoFunc(f); setGheSelecionado('') }}>
                          Vincular GHE
                        </button>
                      )}
                      {/* Criar S-2240 */}
                      {ghe && st.label === 'Não transmitido' && (
                        <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }}
                          onClick={() => criarTransmissao(f.id)}>
                          📋 Criar S-2240
                        </button>
                      )}
                      {/* Transmitir */}
                      {st.pode && tx && (
                        <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }}
                          onClick={() => router.push('/transmissao-manual')}>
                          📡 Transmitir
                        </button>
                      )}
                      {/* Trocar GHE */}
                      {ghe && (
                        <button style={{ ...s.btnAcao, color:'#6b7280', fontSize:10 }}
                          onClick={() => { setMapeandoFunc(f); setGheSelecionado(String(ltcatAtivo.ghes.indexOf(ghe))) }}>
                          Trocar GHE
                        </button>
                      )}
                      {/* Editar funcionário */}
                      <button style={{ ...s.btnAcao, color:'#374151' }}
                        onClick={() => abrirEditar(f)}>
                        ✏ Editar
                      </button>
                      {/* Excluir — sempre visível */}
                      <button style={{ ...s.btnAcao, color:'#E24B4A', borderColor:'#F09595' }}
                        onClick={() => tx ? setConfirmExcluirTx(tx) : setConfirmExcluirFunc(f)}>
                        🗑 Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* Modal confirmar remoção de funcionário */}
      {confirmExcluirFunc && (
        <div style={s.overlay} onClick={() => setConfirmExcluirFunc(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:14, fontWeight:600, color:'#111', marginBottom:8 }}>🗑 Remover funcionário</div>
            <div style={{ fontSize:13, color:'#374151', marginBottom:14, lineHeight:1.6 }}>
              Remover <strong>{confirmExcluirFunc.nome}</strong> da lista?
              <div style={{ marginTop:8, background:'#FAEEDA', padding:'8px 12px', borderRadius:8, color:'#633806', fontSize:12 }}>
                O funcionário será desativado mas seus dados e transmissões serão mantidos.
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...s.btnOutline, color:'#E24B4A', borderColor:'#F09595' }}
                onClick={() => excluirFuncionario(confirmExcluirFunc.id)}>
                Confirmar remoção
              </button>
              <button style={s.btnOutline} onClick={() => setConfirmExcluirFunc(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar exclusão de transmissão */}
      {confirmExcluirTx && (
        <div style={s.overlay} onClick={() => setConfirmExcluirTx(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:14, fontWeight:600, color:'#111', marginBottom:8 }}>🗑 Excluir transmissão S-2240</div>
            <div style={{ fontSize:13, color:'#374151', marginBottom:14, lineHeight:1.6 }}>
              Confirma a exclusão da transmissão S-2240 deste funcionário?
              {confirmExcluirTx.status === 'enviado' && (
                <div style={{ marginTop:8, background:'#FCEBEB', padding:'8px 12px', borderRadius:8, color:'#E24B4A', fontSize:12 }}>
                  ⚠ Esta transmissão já foi enviada ao Gov.br. A exclusão é apenas local.
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...s.btnOutline, color:'#E24B4A', borderColor:'#F09595' }}
                onClick={() => excluirTransmissao(confirmExcluirTx.id)}>
                Confirmar exclusão
              </button>
              <button style={s.btnOutline} onClick={() => setConfirmExcluirTx(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal edição — dados + exames */}
      {editandoFunc && (
        <div style={s.overlay} onClick={() => setEditandoFunc(null)}>
          <div style={{ ...s.modal, width:580 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:'#111' }}>✏ Editar — {editandoFunc.nome}</div>
                {asoDoFunc && (
                  <div style={{ fontSize:11, color:'#9ca3af' }}>
                    Último ASO: {asoDoFunc.tipo_aso} · {new Date(asoDoFunc.data_exame+'T12:00').toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
              <button onClick={() => setEditandoFunc(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9ca3af' }}>×</button>
            </div>

            {sucesso && <div style={{ background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'9px 12px', fontSize:12, marginBottom:12 }}>{sucesso}</div>}
            {erro    && <div style={{ background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'9px 12px', fontSize:12, marginBottom:12 }}>{erro}</div>}

            {/* Abas */}
            <div style={{ display:'flex', borderBottom:'0.5px solid #e5e7eb', marginBottom:16 }}>
              {(['dados', 'exames'] as const).map(aba => (
                <button key={aba} onClick={() => { setAbaModal(aba); setSucesso(''); setErro('') }}
                  style={{ padding:'7px 16px', fontSize:12, fontWeight:600, border:'none', cursor:'pointer',
                    background:'transparent',
                    color: abaModal === aba ? '#185FA5' : '#9ca3af',
                    borderBottom: abaModal === aba ? '2px solid #185FA5' : '2px solid transparent',
                    marginBottom: -1,
                  }}>
                  {aba === 'dados' ? 'Dados do Funcionário' : `Exames do ASO (${formExames.length})`}
                </button>
              ))}
            </div>

            {/* Aba dados */}
            {abaModal === 'dados' && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  {([
                    ['Nome completo','nome','text'],
                    ['CPF','cpf','text'],
                    ['Nascimento','data_nasc','date'],
                    ['Admissão','data_adm','date'],
                    ['Matrícula eSocial','matricula_esocial','text'],
                    ['Função / Cargo','funcao','text'],
                    ['Setor / GHE','setor','text'],
                  ] as [string,string,string][]).map(([label, field, type]) => (
                    <div key={field}>
                      <label style={s.label}>{label}</label>
                      <input style={s.input} type={type} value={formEdit[field]||''}
                        onChange={e => setFormEdit((p:any) => ({...p, [field]: e.target.value}))}/>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button style={s.btnPrimary} onClick={salvarEdicaoFunc} disabled={salvandoEdit}>
                    {salvandoEdit ? 'Salvando...' : 'Salvar dados'}
                  </button>
                  <button style={s.btnOutline} onClick={() => setEditandoFunc(null)}>Fechar</button>
                </div>
              </>
            )}

            {/* Aba exames */}
            {abaModal === 'exames' && (
              <>
                {!asoDoFunc ? (
                  <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af', fontSize:12, background:'#f9fafb', borderRadius:8, marginBottom:14 }}>
                    Este funcionário não tem ASO cadastrado.<br/>
                    <a href="/leitor?tipo=aso" style={{ color:'#185FA5' }}>Importar ASO</a>
                  </div>
                ) : (
                  <>
                    {/* Lista de exames */}
                    <div style={{ marginBottom:14 }}>
                      {formExames.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'1.5rem', color:'#9ca3af', fontSize:12, background:'#f9fafb', borderRadius:8 }}>
                          Nenhum exame no ASO. Adicione abaixo.
                        </div>
                      ) : (
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                          <thead>
                            <tr style={{ background:'#f9fafb' }}>
                              <th style={s.th}>Cód. eSocial</th>
                              <th style={s.th}>Exame</th>
                              <th style={s.th}>Resultado</th>
                              <th style={s.th}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {formExames.map((ex: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                                <td style={{ ...s.td, fontFamily:'monospace', fontWeight:600, color:'#185FA5' }}>
                                  {ex.codigo || codigoDeExame(ex.nome)}
                                </td>
                                <td style={s.td}>{ex.nome}</td>
                                <td style={s.td}>
                                  <select value={ex.resultado}
                                    onChange={e => atualizarResultado(idx, e.target.value)}
                                    style={{ padding:'3px 6px', fontSize:11, border:'0.5px solid #d1d5db', borderRadius:5,
                                      background: ex.resultado === 'Normal' ? '#EAF3DE' : ex.resultado === 'Alterado' ? '#FCEBEB' : '#FAEEDA',
                                      color: ex.resultado === 'Normal' ? '#27500A' : ex.resultado === 'Alterado' ? '#791F1F' : '#633806',
                                      fontWeight:600, cursor:'pointer',
                                    }}>
                                    <option value="Normal">Normal</option>
                                    <option value="Alterado">Alterado</option>
                                    <option value="Pendente">Pendente</option>
                                  </select>
                                </td>
                                <td style={s.td}>
                                  <button onClick={() => removerExame(idx)}
                                    style={{ padding:'3px 8px', fontSize:10, background:'transparent', border:'0.5px solid #F09595', borderRadius:5, cursor:'pointer', color:'#E24B4A' }}>
                                    Remover
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Adicionar */}
                    <div style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:8, padding:'12px 14px', marginBottom:14 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'#374151', marginBottom:8 }}>Adicionar exame</div>
                      <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                        <div style={{ flex:1 }}>
                          <label style={s.label}>Exame (Tabela 27)</label>
                          <select style={s.input} value={novoExameCodigo}
                            onChange={e => setNovoExameCodigo(e.target.value)}>
                            {EXAMES_ESOCIAL.map(e => (
                              <option key={e.codigo} value={e.codigo}>{e.codigo} — {e.nome}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ width:120 }}>
                          <label style={s.label}>Resultado</label>
                          <select style={s.input} value={novoExameResultado}
                            onChange={e => setNovoExameResultado(e.target.value as any)}>
                            <option value="Normal">Normal</option>
                            <option value="Alterado">Alterado</option>
                            <option value="Pendente">Pendente</option>
                          </select>
                        </div>
                        <button onClick={adicionarExame}
                          style={{ ...s.btnPrimary, padding:'8px 12px', whiteSpace:'nowrap' }}>
                          + Adicionar
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div style={{ display:'flex', gap:8 }}>
                  {asoDoFunc && (
                    <button style={s.btnPrimary} onClick={salvarExames} disabled={salvandoEdit}>
                      {salvandoEdit ? 'Salvando...' : 'Salvar exames'}
                    </button>
                  )}
                  <button style={s.btnOutline} onClick={() => setEditandoFunc(null)}>Fechar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
  label:      { display:'block', fontSize:11, fontWeight:500, color:'#374151', marginBottom:3 },
  input:      { width:'100%', padding:'7px 9px', fontSize:12, border:'1px solid #d1d5db', borderRadius:7, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' },
  btnAcao:    { padding:'3px 10px', fontSize:11, background:'transparent', border:'0.5px solid #d1d5db', borderRadius:6, cursor:'pointer', color:'#374151', whiteSpace:'nowrap' },
  btnPrimary: { padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnOutline: { padding:'8px 14px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', color:'#374151' },
  erroBox:    { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  sucessoBox: { background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modal:      { background:'#fff', borderRadius:12, padding:'1.5rem', width:480, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' },
}
