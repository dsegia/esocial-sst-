import { useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Leitor() {
  const router = useRouter()
  const inputRef = useRef()
  const [etapa, setEtapa] = useState('upload')
  const [tipoDoc, setTipoDoc] = useState('aso')
  const [arquivo, setArquivo] = useState(null)
  const [progresso, setProgresso] = useState('')
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState(null)
  const [dadosEditados, setDadosEditados] = useState(null)
  const [empresaId, setEmpresaId] = useState('')
  const [funcionarios, setFuncionarios] = useState([])
  const [funcMatch, setFuncMatch] = useState(null)
  const [modoLeitura, setModoLeitura] = useState('')

  useState(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
        .then(({ data: user }) => {
          if (!user) return
          setEmpresaId(user.empresa_id)
          supabase.from('funcionarios').select('id, nome, cpf, matricula_esocial, funcao, setor')
            .eq('empresa_id', user.empresa_id).eq('ativo', true).order('nome')
            .then(({ data: funcs }) => setFuncionarios(funcs || []))
        })
    })
  }, [])

  async function carregarPDFJS() {
    if (window.pdfjsLib) return window.pdfjsLib
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      s.onload = resolve; s.onerror = reject
      document.head.appendChild(s)
    })
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    return window.pdfjsLib
  }

  async function extrairTextoPDF(file) {
    const lib = await carregarPDFJS()
    const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise
    let txt = ''
    for (let i = 1; i <= Math.min(pdf.numPages, 6); i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      txt += content.items.map(it => it.str).join(' ') + '\n'
    }
    return txt.trim()
  }

  async function pdfParaImagens(file) {
    const lib = await carregarPDFJS()
    const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise
    const imgs = []
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      setProgresso(`Convertendo página ${i} de ${Math.min(pdf.numPages, 3)}...`)
      const page = await pdf.getPage(i)
      const vp = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      canvas.width = vp.width; canvas.height = vp.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
      imgs.push(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
    return imgs
  }

  async function lerXML(file) {
    const txt = await file.text()
    const doc = new DOMParser().parseFromString(txt, 'text/xml')
    const get = tag => doc.querySelector(tag)?.textContent?.trim() || null
    const tipoMap = {'0':'admissional','1':'periodico','2':'retorno','3':'mudanca','4':'demissional','5':'monitoracao'}
    const concMap = {'1':'apto','2':'apto_restricao','3':'inapto'}
    return {
      funcionario: { nome:get('nmTrab'), cpf:get('cpfTrab'), matricula:get('matricula'), funcao:null, setor:null, data_nasc:null, data_adm:null },
      aso: { tipo_aso:tipoMap[get('tpAso')]||'periodico', data_exame:fmtData(get('dtAso')), prox_exame:null, conclusao:concMap[get('concl')]||'apto', medico_nome:get('nmMed'), medico_crm:get('nrCRM') },
      exames:[], riscos:[],
      confianca:{ nome:99, cpf:99, tipo_aso:99, data_exame:99, conclusao:99 }
    }
  }

  function fmtData(iso) {
    if (!iso || iso.length < 10) return null
    const [y,m,d] = iso.substring(0,10).split('-')
    return `${d}/${m}/${y}`
  }

  async function processarArquivo() {
    if (!arquivo) return
    setErro(''); setEtapa('lendo')
    try {
      if (arquivo.name.toLowerCase().endsWith('.xml')) {
        setProgresso('Lendo XML eSocial...')
        finalizar(await lerXML(arquivo), 'XML')
        return
      }
      setProgresso('Analisando PDF...')
      const texto = await extrairTextoPDF(arquivo)
      const temTexto = texto.replace(/\s/g,'').length > 100
      let payload

      if (temTexto) {
        setProgresso('PDF digital detectado. Extraindo dados com IA...')
        payload = { texto_pdf: texto, paginas: [], tipo: tipoDoc }
      } else {
        setProgresso('PDF escaneado. Convertendo em imagens...')
        const paginas = await pdfParaImagens(arquivo)
        setProgresso('Analisando com IA...')
        payload = { paginas, texto_pdf: '', tipo: tipoDoc }
      }

      const resp = await fetch('/api/ler-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await resp.json()
      if (!resp.ok || !json.sucesso) throw new Error(json.erro || 'Erro na leitura')
      finalizar(json.dados, json.modo)
    } catch (err) {
      setErro(err.message)
      setEtapa('upload')
    }
  }

  function finalizar(d, modo) {
    if (d.funcionario?.cpf) {
      const cpfLimpo = d.funcionario.cpf.replace(/\D/g,'')
      const match = funcionarios.find(f => f.cpf.replace(/\D/g,'') === cpfLimpo)
      if (match) setFuncMatch(match)
    }
    setDados(d)
    setDadosEditados(JSON.parse(JSON.stringify(d)))
    setModoLeitura(modo)
    setEtapa('preview')
  }

  function atualizarCampo(path, valor) {
    setDadosEditados(prev => {
      const novo = JSON.parse(JSON.stringify(prev))
      const partes = path.split('.')
      let obj = novo
      for (let i = 0; i < partes.length - 1; i++) obj = obj[partes[i]]
      obj[partes[partes.length - 1]] = valor
      return novo
    })
  }

  async function salvar() {
    setEtapa('salvando')
    try {
      const d = dadosEditados
      let funcId = funcMatch?.id

      if (!funcId) {
        const { data: novoFunc, error } = await supabase.from('funcionarios').insert({
          empresa_id: empresaId,
          nome: d.funcionario?.nome || 'Não identificado',
          cpf: d.funcionario?.cpf || '000.000.000-00',
          data_nasc: converterData(d.funcionario?.data_nasc) || null,
          data_adm: converterData(d.funcionario?.data_adm) || null,
          matricula_esocial: d.funcionario?.matricula || ('PEND-' + Date.now()),
          funcao: d.funcionario?.funcao || null,
          setor: d.funcionario?.setor || null,
        }).select().single()
        if (error) throw new Error('Erro ao criar funcionário: ' + error.message)
        funcId = novoFunc.id
      }

      if (tipoDoc === 'aso') {
        // ── VERIFICAR DUPLICIDADE ──────────────────────
        const dataExame = converterData(d.aso?.data_exame) || new Date().toISOString().split('T')[0]
        const dupResp = await fetch('/api/verificar-duplicidade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funcionario_id: funcId,
            tipo_aso: d.aso?.tipo_aso || 'periodico',
            data_exame: dataExame,
          })
        })
        const dup = await dupResp.json()

        if (dup.duplicado) {
          const dataFmt = new Date(dup.data_exame + 'T12:00:00').toLocaleDateString('pt-BR')
          const msg = dup.jaTransmitido
            ? `⚠️ ASO DUPLICADO E JÁ TRANSMITIDO!\n\nJá existe um ASO ${dup.tipo_aso} para ${dup.funcionario} em ${dataFmt} com recibo de transmissão.\n\nDeseja salvar mesmo assim como retificação?`
            : `⚠️ ASO DUPLICADO!\n\nJá existe um ASO ${dup.tipo_aso} para ${dup.funcionario} em ${dataFmt}.\n\nDeseja salvar mesmo assim?`

          if (!confirm(msg)) {
            setEtapa('preview')
            return
          }
        }
        // ───────────────────────────────────────────────

        const { data: aso, error } = await supabase.from('asos').insert({
          funcionario_id: funcId, empresa_id: empresaId,
          tipo_aso: d.aso?.tipo_aso || 'periodico',
          data_exame: converterData(d.aso?.data_exame) || new Date().toISOString().split('T')[0],
          prox_exame: converterData(d.aso?.prox_exame) || null,
          conclusao: d.aso?.conclusao || 'apto',
          medico_nome: d.aso?.medico_nome || null,
          medico_crm: d.aso?.medico_crm || null,
          exames: d.exames || [],
          riscos: d.riscos || [],
        }).select().single()
        if (error) throw new Error(error.message)
        await supabase.from('transmissoes').insert({
          empresa_id: empresaId, funcionario_id: funcId,
          evento: 'S-2220', referencia_id: aso.id, referencia_tipo: 'aso',
          status: 'pendente', tentativas: 0, ambiente: 'producao_restrita',
        })
      } else {
        const { data: ltcat, error } = await supabase.from('ltcats').insert({
          empresa_id: empresaId,
          data_emissao: converterData(d.dados_gerais?.data_emissao) || new Date().toISOString().split('T')[0],
          data_vigencia: converterData(d.dados_gerais?.data_vigencia) || new Date().toISOString().split('T')[0],
          prox_revisao: converterData(d.dados_gerais?.prox_revisao) || null,
          resp_nome: d.dados_gerais?.resp_nome || '',
          resp_conselho: d.dados_gerais?.resp_conselho || 'CREA',
          resp_registro: d.dados_gerais?.resp_registro || null,
          ghes: d.ghes || [], ativo: true,
        }).select().single()
        if (error) throw new Error(error.message)
        await supabase.from('transmissoes').insert({
          empresa_id: empresaId, evento: 'S-2240',
          referencia_id: ltcat.id, referencia_tipo: 'ltcat',
          status: 'pendente', tentativas: 0, ambiente: 'producao_restrita',
        })
      }
      setEtapa('sucesso')
    } catch (err) {
      setErro('Erro ao salvar: ' + err.message)
      setEtapa('preview')
    }
  }

  function converterData(br) {
    if (!br) return null
    const p = br.split('/')
    return p.length === 3 ? `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` : null
  }

  function corConf(v) { return !v || v < 70 ? '#E24B4A' : v < 90 ? '#EF9F27' : '#1D9E75' }

  return (
    <Layout pagina="leitor">
      <Head><title>Leitor Inteligente — eSocial SST</title></Head>
      <div style={s.header}>
        <div>
          <div style={s.titulo}>Leitor inteligente de documentos</div>
          <div style={s.sub}>PDF ou XML → extração automática → confirmar → salvar</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {[['aso','ASO (S-2220)','#185FA5'],['ltcat','LTCAT (S-2240)','#854F0B']].map(([k,l,c]) => (
            <button key={k} onClick={() => setTipoDoc(k)} style={{
              padding:'6px 14px', borderRadius:99, fontSize:12, fontWeight:500, cursor:'pointer', border:'none',
              background: tipoDoc===k ? c : '#f3f4f6', color: tipoDoc===k ? '#fff' : '#6b7280',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {erro && <div style={s.erroBox}><strong>Erro:</strong> {erro}</div>}

      {etapa === 'upload' && (
        <div style={s.card}>
          <div style={s.dropZone} onClick={() => inputRef.current.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='#185FA5' }}
            onDragLeave={e => { e.currentTarget.style.borderColor='#d1d5db' }}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor='#d1d5db'; const f=e.dataTransfer.files[0]; if(f) setArquivo(f) }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            <div style={{ fontSize:14, fontWeight:500, color:'#374151', marginTop:10 }}>
              {arquivo ? arquivo.name : 'Clique ou arraste o arquivo aqui'}
            </div>
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>PDF (digital ou escaneado) · XML eSocial</div>
            {arquivo && <div style={{ marginTop:8, fontSize:12, color:'#185FA5', fontWeight:500 }}>✓ {arquivo.name} ({(arquivo.size/1024).toFixed(0)} KB) — pronto</div>}
          </div>
          <input ref={inputRef} type="file" accept=".pdf,.xml" style={{ display:'none' }} onChange={e => setArquivo(e.target.files[0])} />
          {arquivo && <button style={{ ...s.btnPrimary, marginTop:12, width:'100%' }} onClick={processarArquivo}>Ler documento com IA →</button>}
          <div style={{ marginTop:12, padding:'10px 14px', background:'#f9fafb', borderRadius:8, fontSize:12, color:'#6b7280', lineHeight:1.9 }}>
            <strong>Como funciona:</strong> PDF digital → extração direta de texto (rápido e preciso) · PDF escaneado → análise visual com IA · XML eSocial → leitura direta dos campos
          </div>
        </div>
      )}

      {etapa === 'lendo' && (
        <div style={{ ...s.card, textAlign:'center', padding:'3rem' }}>
          <div style={{ width:48, height:48, border:'3px solid #185FA5', borderTopColor:'transparent', borderRadius:'50%', margin:'0 auto 14px', animation:'spin 1s linear infinite' }}></div>
          <div style={{ fontSize:14, fontWeight:500, color:'#111', marginBottom:4 }}>Processando documento...</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>{progresso}</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {etapa === 'preview' && dadosEditados && (
        <div style={{ ...s.card, border:'1.5px solid #1D9E75' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#085041' }}>Dados extraídos — edite se necessário e confirme</div>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:11, background:'#E6F1FB', color:'#0C447C', padding:'2px 10px', borderRadius:99 }}>
                {modoLeitura === 'texto' ? '📄 PDF digital' : modoLeitura === 'XML' ? '🔧 XML eSocial' : '📷 PDF escaneado'}
              </span>
              <span style={{ fontSize:10, color:'#6b7280' }}>● verde = alta confiança · amarelo = verificar · vermelho = preencher</span>
            </div>
          </div>

          {tipoDoc === 'aso' && dadosEditados.funcionario && (
            <div style={{ marginBottom:16 }}>
              <div style={s.secLabel}>Funcionário</div>
              {funcMatch ? (
                <div style={{ background:'#EAF3DE', border:'0.5px solid #9FE1CB', borderRadius:8, padding:'9px 12px', fontSize:12, color:'#085041', marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span>✓ Encontrado no cadastro: <strong>{funcMatch.nome}</strong> — {funcMatch.cpf}</span>
                  <button onClick={() => setFuncMatch(null)} style={{ fontSize:11, color:'#E24B4A', background:'none', border:'none', cursor:'pointer' }}>Trocar</button>
                </div>
              ) : (
                <div style={{ marginBottom:10 }}>
                  <div style={{ background:'#FAEEDA', border:'0.5px solid #FAC775', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#633806', marginBottom:6 }}>
                    CPF não encontrado no cadastro. Selecione um existente ou será criado novo funcionário.
                  </div>
                  <select style={s.input} onChange={e => setFuncMatch(funcionarios.find(f=>f.id===e.target.value)||null)}>
                    <option value="">— criar novo com dados do documento —</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.cpf}</option>)}
                  </select>
                </div>
              )}
              <div style={s.grid2}>
                {campoEdit('Nome', dadosEditados.funcionario.nome, dadosEditados.confianca?.nome, v => atualizarCampo('funcionario.nome', v))}
                {campoEdit('CPF', dadosEditados.funcionario.cpf, dadosEditados.confianca?.cpf, v => atualizarCampo('funcionario.cpf', v))}
                {campoEdit('Função', dadosEditados.funcionario.funcao, 70, v => atualizarCampo('funcionario.funcao', v))}
                {campoEdit('Setor / GHE', dadosEditados.funcionario.setor, 70, v => atualizarCampo('funcionario.setor', v))}
              </div>
            </div>
          )}

          {tipoDoc === 'aso' && dadosEditados.aso && (
            <div style={{ marginBottom:16 }}>
              <div style={s.secLabel}>Dados do ASO</div>
              <div style={s.grid2}>
                {campoEdit('Tipo de exame', dadosEditados.aso.tipo_aso, dadosEditados.confianca?.tipo_aso, v => atualizarCampo('aso.tipo_aso', v))}
                {campoEdit('Conclusão', dadosEditados.aso.conclusao, dadosEditados.confianca?.conclusao, v => atualizarCampo('aso.conclusao', v))}
                {campoEdit('Data do exame', dadosEditados.aso.data_exame, dadosEditados.confianca?.data_exame, v => atualizarCampo('aso.data_exame', v))}
                {campoEdit('Próximo exame', dadosEditados.aso.prox_exame, 75, v => atualizarCampo('aso.prox_exame', v))}
                {campoEdit('Médico', dadosEditados.aso.medico_nome, 80, v => atualizarCampo('aso.medico_nome', v))}
                {campoEdit('CRM', dadosEditados.aso.medico_crm, dadosEditados.confianca?.medico_crm, v => atualizarCampo('aso.medico_crm', v))}
              </div>
            </div>
          )}

          {tipoDoc === 'aso' && dadosEditados.exames?.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={s.secLabel}>Exames realizados ({dadosEditados.exames.length}) — Tabela 27 eSocial</div>
                <span style={{ fontSize:10, color:'#9ca3af' }}>Código = Tabela 27 obrigatória na transmissão</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {dadosEditados.exames.map((ex, i) => {
                  const bg = ex.resultado==='Normal'?'#EAF3DE':ex.resultado==='Alterado'?'#FCEBEB':'#FAEEDA'
                  const cor = ex.resultado==='Normal'?'#085041':ex.resultado==='Alterado'?'#791F1F':'#633806'
                  return (
                    <div key={i} style={{ padding:'4px 10px', borderRadius:8, fontSize:11, fontWeight:500, background:bg, color:cor, display:'flex', alignItems:'center', gap:6 }}>
                      <span>{ex.nome}: {ex.resultado}</span>
                      {ex.codigo_t27 && (
                        <span style={{ padding:'1px 6px', borderRadius:99, fontSize:9, fontWeight:700, background:'rgba(0,0,0,0.1)', fontFamily:'monospace' }}>
                          T27:{ex.codigo_t27}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              {dadosEditados.exames.some(e => e.codigo_t27 === '0200') && (
                <div style={{ marginTop:6, fontSize:11, color:'#EF9F27' }}>
                  ⚠ Exames com código 0200 (Outros) — verifique se estão corretos antes de transmitir.
                </div>
              )}
            </div>
          )}

          {tipoDoc === 'aso' && (dadosEditados.riscos?.length > 0 || dadosEditados.riscos_codificados?.length > 0) && (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={s.secLabel}>Riscos identificados — Tabela 24 eSocial (Aposentadoria Especial)</div>
                <span style={{ fontSize:10, color:'#9ca3af' }}>Código = obrigatório no S-2240</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {(dadosEditados.riscos_codificados || dadosEditados.riscos?.map(r=>({nome:r,codigo_t24:'09.01.001',tipo:'aus'}))).map((r, i) => {
                  const COR_TIPO = { fis:'#E6F1FB', qui:'#FAEEDA', bio:'#EAF3DE', aus:'#f3f4f6', out:'#FAEEDA' }
                  const TXT_TIPO = { fis:'#0C447C', qui:'#633806', bio:'#27500A', aus:'#6b7280', out:'#633806' }
                  const bg  = COR_TIPO[r.tipo] || '#f3f4f6'
                  const cor = TXT_TIPO[r.tipo] || '#374151'
                  return (
                    <div key={i} style={{ padding:'4px 10px', borderRadius:8, fontSize:11, fontWeight:500, background:bg, color:cor, display:'flex', alignItems:'center', gap:6 }}>
                      <span>{r.nome}</span>
                      <span style={{ padding:'1px 6px', borderRadius:99, fontSize:9, fontWeight:700, background:'rgba(0,0,0,0.1)', fontFamily:'monospace' }}>
                        T24:{r.codigo_t24}
                      </span>
                    </div>
                  )
                })}
              </div>
              {(dadosEditados.riscos_codificados || []).some(r => !r.codigo_t24?.startsWith('09')) && (
                <div style={{ marginTop:6, fontSize:11, color:'#E24B4A', fontWeight:500 }}>
                  ⚠ Agentes nocivos identificados — trabalhador pode ter direito à aposentadoria especial.
                </div>
              )}
            </div>
          )}

          {tipoDoc === 'ltcat' && dadosEditados.dados_gerais && (
            <div style={{ marginBottom:16 }}>
              <div style={s.secLabel}>Dados gerais do LTCAT</div>
              <div style={s.grid2}>
                {campoEdit('Data emissão', dadosEditados.dados_gerais.data_emissao, dadosEditados.confianca?.data_emissao, v => atualizarCampo('dados_gerais.data_emissao', v))}
                {campoEdit('Próxima revisão', dadosEditados.dados_gerais.prox_revisao, 80, v => atualizarCampo('dados_gerais.prox_revisao', v))}
                {campoEdit('Responsável', dadosEditados.dados_gerais.resp_nome, dadosEditados.confianca?.resp_nome, v => atualizarCampo('dados_gerais.resp_nome', v))}
                {campoEdit('Conselho', dadosEditados.dados_gerais.resp_conselho, 85, v => atualizarCampo('dados_gerais.resp_conselho', v))}
                {campoEdit('Registro', dadosEditados.dados_gerais.resp_registro, 85, v => atualizarCampo('dados_gerais.resp_registro', v))}
              </div>
              {dadosEditados.ghes?.length > 0 && (
                <div style={{ fontSize:12, color:'#374151', marginTop:8, padding:'8px 12px', background:'#f9fafb', borderRadius:8 }}>
                  {dadosEditados.ghes.length} GHE(s) identificado(s) com {dadosEditados.ghes.reduce((a,g)=>a+(g.agentes?.length||0),0)} agente(s) de risco
                </div>
              )}
            </div>
          )}

          <div style={{ display:'flex', gap:10, marginTop:8 }}>
            <button style={s.btnPrimary} onClick={salvar}>Confirmar e salvar →</button>
            <button style={s.btnOutline} onClick={() => { setEtapa('upload'); setDados(null); setArquivo(null); setFuncMatch(null) }}>Cancelar</button>
          </div>
        </div>
      )}

      {etapa === 'salvando' && (
        <div style={{ ...s.card, textAlign:'center', padding:'3rem' }}>
          <div style={{ fontSize:14, fontWeight:500, color:'#111' }}>Salvando no banco...</div>
        </div>
      )}

      {etapa === 'sucesso' && (
        <div style={{ ...s.card, textAlign:'center', padding:'3rem' }}>
          <div style={{ width:56, height:56, background:'#EAF3DE', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style={{ fontSize:15, fontWeight:600, color:'#085041', marginBottom:6 }}>Salvo com sucesso!</div>
          <div style={{ fontSize:13, color:'#374151', marginBottom:20 }}>Documento salvo e transmissão registrada como pendente.</div>
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button style={s.btnPrimary} onClick={() => { setEtapa('upload'); setDados(null); setArquivo(null); setFuncMatch(null) }}>Ler outro documento</button>
            <button style={s.btnOutline} onClick={() => router.push('/historico')}>Ver histórico →</button>
          </div>
        </div>
      )}
    </Layout>
  )

  function campoEdit(label, valor, confianca, onChange) {
    const cor = corConf(confianca)
    return (
      <div key={label} style={{ marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
          <span style={{ fontSize:11, fontWeight:500, color:'#374151' }}>{label}</span>
          <span style={{ width:7, height:7, borderRadius:'50%', background:cor, display:'inline-block', flexShrink:0 }} title={`Confiança: ${confianca||0}%`}></span>
        </div>
        <input style={{ ...s.input, borderColor: cor + '66' }}
          defaultValue={valor || ''}
          onChange={e => onChange(e.target.value)} />
      </div>
    )
  }
}

const s = {
  header:   { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' },
  titulo:   { fontSize:20, fontWeight:700, color:'#111' },
  sub:      { fontSize:12, color:'#6b7280', marginTop:2 },
  card:     { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' },
  dropZone: { border:'2px dashed #d1d5db', borderRadius:10, padding:'2.5rem', textAlign:'center', cursor:'pointer', transition:'border-color .15s' },
  secLabel: { fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 },
  grid2:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  input:    { width:'100%', padding:'7px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:7, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit', outline:'none' },
  erroBox:  { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12, lineHeight:1.6 },
  btnPrimary: { padding:'10px 20px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnOutline: { padding:'10px 20px', background:'transparent', color:'#374151', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer' },
}
