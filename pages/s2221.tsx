import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { getEmpresaId } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TIPOS_EXAME = [
  { v: 'admissional',   l: 'Admissional',        desc: 'Na contratação do motorista' },
  { v: 'periodico',     l: 'Periódico',           desc: 'Durante vigência do contrato' },
  { v: 'retorno',       l: 'Retorno ao trabalho', desc: 'Após afastamento ≥ 30 dias' },
  { v: 'demissional',   l: 'Demissional',         desc: 'No desligamento' },
]

const RESULTADOS = [
  { v: 'negativo',   l: 'Negativo (Apto)',     c: '#1D9E75', bg: '#EAF3DE' },
  { v: 'positivo',   l: 'Positivo (Inapto)',   c: '#E24B4A', bg: '#FCEBEB' },
  { v: 'inconcl',    l: 'Inconclusivo',         c: '#EF9F27', bg: '#FAEEDA' },
]

const SUBSTANCIAS = [
  'Cocaína / Benzoilecgonina',
  'Maconha (THC)',
  'Anfetaminas / Metanfetaminas',
  'Benzodiazepínicos',
  'Opioides',
  'Barbitúricos',
]

const formVazio = () => ({
  funcionario_id: '',
  tipo_exame: 'periodico',
  dt_exame: '',
  resultado: 'negativo',
  laboratorio: '',
  responsavel_nome: '',
  responsavel_crf: '',
  substancias_testadas: SUBSTANCIAS.slice(),
  observacao: '',
})

export default function S2221() {
  const router = useRouter()
  const [empresaId, setEmpresaIdState] = useState('')
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [exames, setExames] = useState<any[]>([])
  const [funcSel, setFuncSel] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')
  const [abaAtiva, setAbaAtiva] = useState<'lista' | 'novo'>('lista')
  const [form, setForm] = useState(formVazio())

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    const empId = getEmpresaId() || user.empresa_id
    setEmpresaIdState(empId)
    const [funcsRes, examesRes] = await Promise.all([
      supabase.from('funcionarios').select('id,nome,cpf,matricula_esocial,funcao,setor').eq('empresa_id', empId).eq('ativo', true).order('nome'),
      supabase.from('transmissoes').select('id,status,payload,funcionario_id,criado_em,dt_envio,recibo').eq('empresa_id', empId).eq('evento', 'S-2221').order('criado_em', { ascending: false }),
    ])
    setFuncionarios(funcsRes.data || [])
    setExames(examesRes.data || [])
    setCarregando(false)
  }

  async function salvar() {
    setErro(''); setSucesso('')
    if (!form.funcionario_id) { setErro('Selecione o funcionário.'); return }
    if (!form.dt_exame)       { setErro('Informe a data do exame.'); return }
    if (!form.laboratorio)    { setErro('Informe o laboratório.'); return }
    setSalvando(true)

    const payload = {
      tipo_exame:          form.tipo_exame,
      dt_exame:            form.dt_exame,
      resultado:           form.resultado,
      laboratorio:         form.laboratorio,
      responsavel_nome:    form.responsavel_nome,
      responsavel_crf:     form.responsavel_crf,
      substancias_testadas: form.substancias_testadas,
      observacao:          form.observacao,
    }

    const { error } = await supabase.from('transmissoes').insert({
      empresa_id:     empresaId,
      funcionario_id: form.funcionario_id,
      evento:         'S-2221',
      referencia_tipo: 'exame_toxicologico',
      status:         'pendente',
      tentativas:     0,
      ambiente:       'producao_restrita',
      payload,
    })

    if (error) { setErro('Erro ao salvar: ' + error.message); setSalvando(false); return }

    setSucesso(`Exame toxicológico registrado — aguardando transmissão.`)
    setForm(formVazio()); setFuncSel(null); setAbaAtiva('lista')
    await init()
    setSalvando(false)
  }

  function toggleSubst(s: string) {
    setForm(f => ({
      ...f,
      substancias_testadas: f.substancias_testadas.includes(s)
        ? f.substancias_testadas.filter(x => x !== s)
        : [...f.substancias_testadas, s],
    }))
  }

  function selecionarFunc(id: string) {
    const f = funcionarios.find(x => x.id === id) || null
    setFuncSel(f)
    setForm(prev => ({ ...prev, funcionario_id: id }))
  }

  function initials(nome: string) {
    return nome.split(' ').filter(Boolean).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()
  }

  const STATUS_LBL: Record<string, { l: string; c: string; bg: string }> = {
    pendente:    { l: 'Pendente',    c: '#854F0B', bg: '#FAEEDA' },
    transmitido: { l: 'Transmitido', c: '#1D9E75', bg: '#EAF3DE' },
    erro:        { l: 'Erro',        c: '#E24B4A', bg: '#FCEBEB' },
    rejeitado:   { l: 'Rejeitado',   c: '#E24B4A', bg: '#FCEBEB' },
  }

  if (carregando) return <div style={s.loading}>Carregando...</div>

  return (
    <Layout pagina="s2221">
      <Head><title>S-2221 Exame Toxicológico — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>S-2221 — Exame Toxicológico</div>
          <div style={s.sub}>Motorista Profissional · Lei 12.619/2012 · Res. CONTRAN 432/2013</div>
        </div>
        <button style={s.btnPrimary} onClick={() => { setAbaAtiva('novo'); setSucesso(''); setErro('') }}>
          + Novo exame
        </button>
      </div>

      {sucesso && <div style={s.sucessoBox}>{sucesso}</div>}
      {erro    && <div style={s.erroBox}>{erro}</div>}

      {/* Abas */}
      <div style={{ display:'flex', gap:4, borderBottom:'0.5px solid #e5e7eb', marginBottom:16 }}>
        {[
          { k: 'lista', l: `Registros (${exames.length})` },
          { k: 'novo',  l: 'Novo exame' },
        ].map(ab => (
          <button key={ab.k} onClick={() => setAbaAtiva(ab.k as any)} style={{
            padding:'8px 16px', fontSize:13, fontWeight: abaAtiva === ab.k ? 600 : 400,
            background:'transparent', border:'none', cursor:'pointer',
            borderBottom: abaAtiva === ab.k ? '2px solid #185FA5' : '2px solid transparent',
            color: abaAtiva === ab.k ? '#185FA5' : '#6b7280',
          }}>{ab.l}</button>
        ))}
      </div>

      {/* ABA LISTA */}
      {abaAtiva === 'lista' && (
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
          {exames.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af', fontSize:13 }}>
              <div style={{ marginBottom:8 }}>Nenhum exame registrado.</div>
              <button style={s.btnPrimary} onClick={() => setAbaAtiva('novo')}>+ Registrar primeiro exame</button>
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr style={{ background:'#f9fafb' }}>
                  {['Funcionário','Tipo','Data exame','Resultado','Laboratório','Status','Ação'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exames.map((ex, i) => {
                  const func = funcionarios.find(f => f.id === ex.funcionario_id)
                  const p = ex.payload || {}
                  const res = RESULTADOS.find(r => r.v === p.resultado)
                  const st = STATUS_LBL[ex.status] || STATUS_LBL.pendente
                  const tipoLabel = TIPOS_EXAME.find(t => t.v === p.tipo_exame)?.l || p.tipo_exame || '—'
                  return (
                    <tr key={ex.id} style={{ borderBottom:'0.5px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={s.td}>
                        <div style={{ fontWeight:500 }}>{func?.nome || '—'}</div>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>{func?.funcao || ''}</div>
                      </td>
                      <td style={s.td}><span style={{ fontSize:12 }}>{tipoLabel}</span></td>
                      <td style={s.td}><span style={{ fontSize:12 }}>{p.dt_exame ? new Date(p.dt_exame + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span></td>
                      <td style={s.td}>
                        {res && (
                          <span style={{ padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:res.bg, color:res.c }}>
                            {res.l}
                          </span>
                        )}
                      </td>
                      <td style={s.td}><span style={{ fontSize:12 }}>{p.laboratorio || '—'}</span></td>
                      <td style={s.td}>
                        <span style={{ padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:st.bg, color:st.c }}>
                          {st.l}
                        </span>
                      </td>
                      <td style={s.td}>
                        <button style={{ ...s.btnAcao, color:'#185FA5', borderColor:'#B5D4F4' }}
                          onClick={() => router.push('/historico')}>
                          Ver histórico
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

      {/* ABA NOVO */}
      {abaAtiva === 'novo' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Funcionário */}
          <div style={s.card}>
            <div style={s.cardTit}>Motorista profissional</div>
            <div style={{ marginBottom:10 }}>
              <label style={s.label}>Funcionário *</label>
              <select style={s.input} value={form.funcionario_id} onChange={e => selecionarFunc(e.target.value)}>
                <option value="">— selecione —</option>
                {funcionarios.map(f => (
                  <option key={f.id} value={f.id}>{f.nome} — {f.cpf}</option>
                ))}
              </select>
            </div>
            {funcSel && (
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#EAF3DE', borderRadius:8, border:'0.5px solid #9FE1CB' }}>
                <div style={{ width:38, height:38, borderRadius:8, background:'#1D9E75', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{initials(funcSel.nome)}</span>
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#085041' }}>{funcSel.nome}</div>
                  <div style={{ fontSize:11, color:'#374151' }}>{funcSel.funcao || '—'} · {funcSel.setor || '—'} · Mat. {funcSel.matricula_esocial}</div>
                </div>
              </div>
            )}
          </div>

          {/* Dados do exame */}
          <div style={s.card}>
            <div style={s.cardTit}>Dados do exame</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={s.label}>Tipo de exame *</label>
                <select style={s.input} value={form.tipo_exame} onChange={e => setForm({...form, tipo_exame: e.target.value})}>
                  {TIPOS_EXAME.map(t => <option key={t.v} value={t.v}>{t.l} — {t.desc}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Data do exame *</label>
                <input type="date" style={s.input} value={form.dt_exame} onChange={e => setForm({...form, dt_exame: e.target.value})} />
              </div>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={s.label}>Resultado</label>
              <div style={{ display:'flex', gap:8 }}>
                {RESULTADOS.map(r => (
                  <button key={r.v} type="button" onClick={() => setForm({...form, resultado: r.v})}
                    style={{
                      flex:1, padding:'8px 12px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600,
                      border: form.resultado === r.v ? `2px solid ${r.c}` : '1.5px solid #e5e7eb',
                      background: form.resultado === r.v ? r.bg : '#fff',
                      color: form.resultado === r.v ? r.c : '#374151',
                    }}>
                    {r.l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={s.label}>Laboratório *</label>
                <input style={s.input} placeholder="Nome do laboratório" value={form.laboratorio} onChange={e => setForm({...form, laboratorio: e.target.value})} />
              </div>
              <div>
                <label style={s.label}>Responsável técnico</label>
                <input style={s.input} placeholder="Nome do responsável" value={form.responsavel_nome} onChange={e => setForm({...form, responsavel_nome: e.target.value})} />
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={s.label}>CRF / CRM do responsável</label>
              <input style={{ ...s.input, maxWidth:200 }} placeholder="Ex: CRF-SP 12345" value={form.responsavel_crf} onChange={e => setForm({...form, responsavel_crf: e.target.value})} />
            </div>
          </div>

          {/* Substâncias testadas */}
          <div style={s.card}>
            <div style={s.cardTit}>Substâncias testadas (Res. CONTRAN 432)</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {SUBSTANCIAS.map(sub => {
                const ativa = form.substancias_testadas.includes(sub)
                return (
                  <button key={sub} type="button" onClick={() => toggleSubst(sub)}
                    style={{
                      padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:500, cursor:'pointer',
                      border: ativa ? '1.5px solid #185FA5' : '1px solid #d1d5db',
                      background: ativa ? '#E6F1FB' : '#fff',
                      color: ativa ? '#0C447C' : '#6b7280',
                    }}>
                    {ativa ? '✓ ' : ''}{sub}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>
              Mínimo obrigatório pela Res. CONTRAN 432/2013: Cocaína, Maconha, Anfetaminas, Benzodiazepínicos, Opioides
            </div>
          </div>

          {/* Observações */}
          <div style={s.card}>
            <label style={s.label}>Observações</label>
            <textarea style={{ ...s.input, height:72, resize:'vertical' }}
              placeholder="Informações adicionais, substâncias em detalhes, laudo complementar..."
              value={form.observacao} onChange={e => setForm({...form, observacao: e.target.value})} />
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button style={s.btnPrimary} onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar e transmitir →'}
            </button>
            <button style={s.btnOutline} onClick={() => { setAbaAtiva('lista'); setErro('') }}>Cancelar</button>
          </div>
        </div>
      )}
    </Layout>
  )
}

const s: Record<string, React.CSSProperties> = {
  loading:    { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' },
  header:     { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' },
  titulo:     { fontSize:20, fontWeight:700, color:'#111' },
  sub:        { fontSize:12, color:'#6b7280', marginTop:2 },
  card:       { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem' },
  cardTit:    { fontSize:13, fontWeight:600, color:'#111', marginBottom:12 },
  label:      { display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 },
  input:      { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' },
  table:      { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:         { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'0.5px solid #e5e7eb', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' },
  td:         { padding:'10px 12px', verticalAlign:'middle', color:'#374151' },
  btnAcao:    { padding:'3px 10px', fontSize:11, background:'transparent', border:'0.5px solid #d1d5db', borderRadius:6, cursor:'pointer', color:'#374151' },
  btnPrimary: { padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnOutline: { padding:'8px 16px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', color:'#374151' },
  erroBox:    { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  sucessoBox: { background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
}
