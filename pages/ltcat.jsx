import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TIPO_AGENTE = { fis:'Físico', qui:'Químico', bio:'Biológico', erg:'Ergonômico' }
const COR_AGENTE  = { fis:'#E6F1FB', qui:'#FAEEDA', bio:'#EAF3DE', erg:'#FCEBEB' }
const TXT_AGENTE  = { fis:'#0C447C', qui:'#633806', bio:'#27500A', erg:'#791F1F' }

export default function LTCAT() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [ltcats, setLtcats] = useState([])
  const [ltcatSel, setLtcatSel] = useState(null)
  const [gheAtivo, setGheAtivo] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [mostrarLeitor, setMostrarLeitor] = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresaId(user.empresa_id)
    const { data } = await supabase
      .from('ltcats')
      .select('*')
      .eq('empresa_id', user.empresa_id)
      .order('data_emissao', { ascending: false })
    setLtcats(data || [])
    if (data && data.length > 0) setLtcatSel(data[0])
    setCarregando(false)
  }

  async function desativar(id) {
    if (!confirm('Arquivar este LTCAT?')) return
    await supabase.from('ltcats').update({ ativo: false }).eq('id', id)
    init()
  }

  function fmtData(d) {
    if (!d) return '—'
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
  }

  function diasParaVencer(d) {
    if (!d) return null
    return Math.round((new Date(d) - new Date()) / 86400000)
  }

  if (carregando) return <div style={s.loading}>Carregando...</div>

  const ghe = ltcatSel?.ghes?.[gheAtivo]

  return (
    <Layout pagina="ltcat">
      <Head><title>LTCAT — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>LTCAT</div>
          <div style={s.sub}>Laudo Técnico das Condições Ambientais do Trabalho · S-2240</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={s.btnOutline} onClick={() => router.push('/leitor?tipo=ltcat')}>
            + Importar PDF
          </button>
          <button style={s.btnPrimary} onClick={() => router.push('/s2240')}>
            + Novo LTCAT manual
          </button>
        </div>
      </div>

      {ltcats.length === 0 ? (
        <div style={s.emptyCard}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
            <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="14,3 14,8 19,8"/>
          </svg>
          <div style={{ fontSize:14, fontWeight:500, color:'#374151', marginTop:12 }}>Nenhum LTCAT cadastrado</div>
          <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>Importe um PDF ou cadastre manualmente</div>
          <div style={{ display:'flex', gap:8, marginTop:16 }}>
            <button style={s.btnPrimary} onClick={() => router.push('/leitor?tipo=ltcat')}>Importar PDF</button>
            <button style={s.btnOutline} onClick={() => router.push('/s2240')}>Cadastrar manual</button>
          </div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:14 }}>

          {/* Lista de LTCATs */}
          <div>
            <div style={s.secLabel}>Laudos cadastrados</div>
            {ltcats.map(lt => {
              const dias = diasParaVencer(lt.prox_revisao)
              const vencido = dias !== null && dias < 0
              const critico = dias !== null && dias >= 0 && dias <= 60
              const ativo = lt.id === ltcatSel?.id
              return (
                <div key={lt.id} onClick={() => { setLtcatSel(lt); setGheAtivo(0) }}
                  style={{
                    ...s.ltcatItem,
                    border: ativo ? '1.5px solid #185FA5' : '0.5px solid #e5e7eb',
                    background: ativo ? '#E6F1FB' : '#fff',
                  }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ fontSize:12, fontWeight:600, color: ativo?'#0C447C':'#111' }}>
                      Emissão: {fmtData(lt.data_emissao)}
                    </div>
                    {lt.ativo
                      ? <span style={s.badgeVigente}>Vigente</span>
                      : <span style={s.badgeArq}>Arquivado</span>}
                  </div>
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>
                    {lt.ghes?.length || 0} GHE(s) · {lt.resp_conselho} {lt.resp_registro}
                  </div>
                  {lt.prox_revisao && (
                    <div style={{ fontSize:11, marginTop:4, fontWeight:500,
                      color: vencido?'#E24B4A': critico?'#EF9F27':'#1D9E75' }}>
                      {vencido ? `Revisão vencida há ${Math.abs(dias)}d` : `Revisão em ${dias}d (${fmtData(lt.prox_revisao)})`}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Detalhe do LTCAT selecionado */}
          {ltcatSel && (
            <div>
              {/* Cabeçalho */}
              <div style={s.card}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#111', marginBottom:6 }}>
                      LTCAT — {fmtData(ltcatSel.data_emissao)}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                      {[
                        { l:'Responsável', v: ltcatSel.resp_nome || '—' },
                        { l:'Conselho/Registro', v: `${ltcatSel.resp_conselho || ''} ${ltcatSel.resp_registro || ''}`.trim() || '—' },
                        { l:'Vigência', v: fmtData(ltcatSel.data_vigencia) },
                        { l:'Próxima revisão', v: fmtData(ltcatSel.prox_revisao) },
                        { l:'GHEs', v: `${ltcatSel.ghes?.length || 0} grupos` },
                        { l:'Agentes', v: `${(ltcatSel.ghes||[]).reduce((a,g)=>a+(g.agentes?.length||0),0)} identificados` },
                      ].map((it,i) => (
                        <div key={i}>
                          <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.04em' }}>{it.l}</div>
                          <div style={{ fontSize:13, fontWeight:500, color:'#111', marginTop:2 }}>{it.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button style={s.btnOutline} onClick={() => router.push(`/s2240`)}>Editar</button>
                    {ltcatSel.ativo && (
                      <button style={{ ...s.btnOutline, color:'#E24B4A', borderColor:'#F09595' }}
                        onClick={() => desativar(ltcatSel.id)}>Arquivar</button>
                    )}
                  </div>
                </div>
              </div>

              {/* GHEs */}
              {ltcatSel.ghes?.length > 0 && (
                <div style={s.card}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div style={s.cardTit}>Grupos Homogêneos de Exposição (GHEs)</div>
                    <div style={{ fontSize:12, color:'#6b7280' }}>{ltcatSel.ghes.length} grupo(s)</div>
                  </div>

                  {/* Tabs GHE */}
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
                    {ltcatSel.ghes.map((g, i) => (
                      <button key={i} onClick={() => setGheAtivo(i)} style={{
                        padding:'5px 12px', fontSize:11, fontWeight:500,
                        borderRadius:99, cursor:'pointer',
                        border: i===gheAtivo ? '1.5px solid #185FA5' : '1px solid #d1d5db',
                        background: i===gheAtivo ? '#185FA5' : '#fff',
                        color: i===gheAtivo ? '#fff' : '#374151',
                      }}>
                        {g.nome || `GHE ${i+1}`}
                      </button>
                    ))}
                  </div>

                  {ghe && (
                    <div style={{ border:'0.5px solid #e5e7eb', borderRadius:10, padding:16 }}>
                      {/* Info GHE */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
                        {[
                          { l:'Setor', v: ghe.setor || '—' },
                          { l:'Trabalhadores', v: ghe.qtd_trabalhadores || '—' },
                          { l:'Aposentadoria especial', v: ghe.aposentadoria_especial ? 'Sim' : 'Não' },
                          { l:'Agentes', v: ghe.agentes?.length || 0 },
                        ].map((it,i) => (
                          <div key={i} style={{ background:'#f9fafb', borderRadius:8, padding:'8px 12px' }}>
                            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.04em' }}>{it.l}</div>
                            <div style={{ fontSize:14, fontWeight:600, color:'#111', marginTop:2 }}>{it.v}</div>
                          </div>
                        ))}
                      </div>

                      {/* Agentes de risco */}
                      {ghe.agentes?.length > 0 && (
                        <div style={{ marginBottom:16 }}>
                          <div style={s.secLabel}>Agentes de risco</div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                            {ghe.agentes.map((ag, i) => (
                              <div key={i} style={{
                                border:'0.5px solid #e5e7eb', borderRadius:8, padding:10,
                                borderLeft:`3px solid ${TXT_AGENTE[ag.tipo]||'#6b7280'}`,
                              }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                                  <span style={{ padding:'1px 8px', borderRadius:99, fontSize:10, fontWeight:600,
                                    background: COR_AGENTE[ag.tipo]||'#f3f4f6',
                                    color: TXT_AGENTE[ag.tipo]||'#374151' }}>
                                    {TIPO_AGENTE[ag.tipo]||ag.tipo}
                                  </span>
                                  {ag.supera_lt && (
                                    <span style={{ fontSize:10, fontWeight:700, color:'#E24B4A' }}>⚠ Supera LT</span>
                                  )}
                                </div>
                                <div style={{ fontSize:13, fontWeight:500, color:'#111' }}>{ag.nome}</div>
                                {(ag.valor || ag.limite) && (
                                  <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>
                                    {ag.valor && `Medido: ${ag.valor}`}
                                    {ag.valor && ag.limite && ' · '}
                                    {ag.limite && `LT: ${ag.limite}`}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* EPC e EPI lado a lado */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        {/* EPC */}
                        <div>
                          <div style={s.secLabel}>EPC — Equipamentos de Proteção Coletiva</div>
                          {!ghe.epc?.length ? (
                            <div style={s.emptySmall}>Nenhum EPC cadastrado</div>
                          ) : ghe.epc.map((e,i) => (
                            <div key={i} style={s.epiRow}>
                              <span style={{ fontSize:16, marginRight:4 }}>{e.eficaz ? '✓' : '✗'}</span>
                              <div>
                                <div style={{ fontSize:13, color:'#111' }}>{e.nome}</div>
                                <div style={{ fontSize:11, color: e.eficaz?'#1D9E75':'#E24B4A' }}>
                                  {e.eficaz ? 'Eficaz' : 'Ineficaz'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* EPI */}
                        <div>
                          <div style={s.secLabel}>EPI — Equipamentos de Proteção Individual</div>
                          {!ghe.epi?.length ? (
                            <div style={s.emptySmall}>Nenhum EPI cadastrado</div>
                          ) : ghe.epi.map((e,i) => (
                            <div key={i} style={s.epiRow}>
                              <span style={{ fontSize:16, marginRight:4 }}>{e.eficaz ? '✓' : '✗'}</span>
                              <div>
                                <div style={{ fontSize:13, color:'#111' }}>{e.nome}</div>
                                <div style={{ fontSize:11, color:'#6b7280' }}>
                                  CA: {e.ca || '—'} · {e.eficaz ? <span style={{color:'#1D9E75'}}>Eficaz</span> : <span style={{color:'#E24B4A'}}>Ineficaz</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Alerta aposentadoria especial */}
                      {ghe.aposentadoria_especial && (
                        <div style={{ marginTop:12, background:'#FCEBEB', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#791F1F' }}>
                          ⚠ Este GHE possui trabalhadores com direito a <strong>aposentadoria especial</strong>. Verifique o PPP eletrônico.
                        </div>
                      )}

                      {/* Alerta agentes que superam LT */}
                      {ghe.agentes?.some(a => a.supera_lt) && (
                        <div style={{ marginTop:8, background:'#FAEEDA', border:'0.5px solid #FAC775', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#633806' }}>
                          ⚠ {ghe.agentes.filter(a=>a.supera_lt).length} agente(s) superam o Limite de Tolerância. Revisão dos EPIs e EPCs necessária.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Transmissão */}
              <div style={s.card}>
                <div style={s.cardTit}>Transmissão S-2240</div>
                <div style={{ fontSize:12, color:'#6b7280', marginTop:6, marginBottom:12 }}>
                  O S-2240 precisa ser transmitido ao Gov.br para cada funcionário exposto aos agentes de risco identificados neste LTCAT.
                </div>
                <button style={s.btnPrimary} onClick={() => router.push('/historico')}>
                  Ver transmissões →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}

const s = {
  loading:     { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' },
  header:      { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' },
  titulo:      { fontSize:20, fontWeight:700, color:'#111' },
  sub:         { fontSize:12, color:'#6b7280', marginTop:2 },
  secLabel:    { fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 },
  card:        { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' },
  cardTit:     { fontSize:13, fontWeight:600, color:'#111' },
  ltcatItem:   { borderRadius:10, padding:'10px 12px', cursor:'pointer', marginBottom:8, transition:'all .15s' },
  badgeVigente:{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600, background:'#EAF3DE', color:'#27500A' },
  badgeArq:    { padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600, background:'#f3f4f6', color:'#6b7280' },
  epiRow:      { display:'flex', alignItems:'flex-start', gap:6, padding:'6px 0', borderBottom:'0.5px solid #f3f4f6' },
  emptySmall:  { fontSize:12, color:'#9ca3af', padding:'8px 0' },
  emptyCard:   { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'3rem', textAlign:'center' },
  btnPrimary:  { padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnOutline:  { padding:'8px 16px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', color:'#374151' },
}
