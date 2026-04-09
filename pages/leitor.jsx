import { useState, useEffect, useRef } from 'react'
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
  const [arquivo, setArquivo] = useState(null)
  const [progresso, setProgresso] = useState('')
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState(null)
  const [dadosEditados, setDadosEditados] = useState(null)
  const [tipoDetectado, setTipoDetectado] = useState('')
  // Tipo fixo definido pela página que chama o leitor (?tipo=aso|ltcat|pcmso)
  const tipoFixo = router.query.tipo || 'aso' // 'aso' ou 'ltcat'
  const [modoLeitura, setModoLeitura] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [funcionarios, setFuncionarios] = useState([])
  const [funcMatch, setFuncMatch] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
        .then(({ data: user }) => {
          if (!user) return
          setEmpresaId(user.empresa_id)
          supabase.from('funcionarios').select('id,nome,cpf,matricula_esocial,funcao,setor')
            .eq('empresa_id', user.empresa_id).eq('ativo', true).order('nome')
            .then(({ data }) => setFuncionarios(data || []))
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

  // Tipo fixo vindo da URL — sem detecção automática
  function detectarTipo(_texto) {
    return tipoFixo // já definido pelo parâmetro da URL
  }

  async function lerXML(file) {
    const txt = await file.text()
    const doc = new DOMParser().parseFromString(txt, 'text/xml')
    const get = tag => doc.querySelector(tag)?.textContent?.trim() || null
    const tipoMap = {'0':'admissional','1':'periodico','2':'retorno','3':'mudanca','4':'demissional','5':'monitoracao'}
    const concMap = {'1':'apto','2':'apto_restricao','3':'inapto'}

    // Detectar tipo pelo XML
    const isLTCAT = !!doc.querySelector('evtExpRisco')
    if (isLTCAT) {
      return {
        tipo: 'ltcat',
        dados: {
          dados_gerais: {
            data_emissao: null, data_vigencia: null, prox_revisao: null,
            resp_nome: get('nmRespReg'), resp_conselho: get('ideOC'), resp_registro: get('nrOC')
          },
          ghes: [], confianca: { data_emissao: 99, resp_nome: 99, ghes: 70 }
        }
      }
    }

    return {
      tipo: 'aso',
      dados: {
        funcionario: { nome:get('nmTrab'), cpf:get('cpfTrab'), matricula:get('matricula'), funcao:null, setor:null, data_nasc:null, data_adm:null },
        aso: { tipo_aso:tipoMap[get('tpAso')]||'periodico', data_exame:fmtData(get('dtAso')), prox_exame:null, conclusao:concMap[get('concl')]||'apto', medico_nome:get('nmMed'), medico_crm:get('nrCRM') },
        exames:[], riscos:[], confianca:{ nome:99, cpf:99, tipo_aso:99, data_exame:99, conclusao:99 }
      }
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
      // XML
      if (arquivo.name.toLowerCase().endsWith('.xml')) {
        setProgresso('Lendo XML eSocial...')
        const { tipo, dados } = await lerXML(arquivo)
        finalizar(dados, tipo, 'XML')
        return
      }

      // PDF — extrair texto
      setProgresso('Analisando PDF...')
      const texto = await extrairTextoPDF(arquivo)
      const temTexto = texto.replace(/\s/g,'').length > 100

      // Detectar tipo pelo conteúdo
      const tipo = detectarTipo(texto)
      const tipoLabel = tipo === 'ltcat' ? 'LTCAT' : tipo === 'pcmso' ? 'PCMSO' : 'ASO'
      setProgresso(`Documento detectado: ${tipoLabel}. Extraindo dados com IA...`)

      let payload
      if (temTexto) {
        payload = { texto_pdf: texto, paginas: [], tipo }
      } else {
        setProgresso('PDF escaneado. Convertendo em imagens...')
        const paginas = await pdfParaImagens(arquivo)
        setProgresso('Analisando com IA...')
        payload = { paginas, texto_pdf: '', tipo }
      }

      const resp = await fetch('/api/ler-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await resp.json()
      if (!resp.ok || !json.sucesso) throw new Error(json.erro || 'Erro na leitura')
      finalizar(json.dados, tipo, json.modo)
    } catch (err) {
      setErro(err.message)
      setEtapa('upload')
    }
  }

  function finalizar(d, tipo, modo) {
    setTipoDetectado(tipo)
    // Só busca funcionário se for ASO
    if (tipo === 'aso' && d.funcionario?.cpf) {
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

      // ── PCMSO: por enquanto redireciona para página PCMSO ──
      if (tipoDetectado === 'pcmso') {
        setEtapa('sucesso')
        return
      }

      // ── LTCAT: salva diretamente na empresa, SEM funcionário ──
      if (tipoDetectado === 'ltcat') {
        const { error } = await supabase.from('ltcats').insert({
          empresa_id: empresaId,
          data_emissao: converterData(d.dados_gerais?.data_emissao) || new Date().toISOString().split('T')[0],
          data_vigencia: converterData(d.dados_gerais?.data_vigencia) || new Date().toISOString().split('T')[0],
          prox_revisao: converterData(d.dados_gerais?.prox_revisao) || null,
          resp_nome: d.dados_gerais?.resp_nome || null,
          resp_conselho: d.dados_gerais?.resp_conselho || 'CREA',
          resp_registro: d.dados_gerais?.resp_registro || null,
          ghes: d.ghes || [],
          ativo: true,
        })
        if (error) throw new Error(error.message)
        setEtapa('sucesso')
        return
      }

      // ── ASO: busca ou cria funcionário ──
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
      } else {
        // Atualizar função/setor do funcionário existente se o ASO trouxer essa info
        const updates = {}
        if (d.funcionario?.funcao && !funcMatch?.funcao) updates.funcao = d.funcionario.funcao
        if (d.funcionario?.setor  && !funcMatch?.setor)  updates.setor  = d.funcionario.setor
        if (d.funcionario?.data_nasc && !funcMatch?.data_nasc) updates.data_nasc = converterData(d.funcionario.data_nasc)
        if (d.funcionario?.data_adm  && !funcMatch?.data_adm)  updates.data_adm  = converterData(d.funcionario.data_adm)
        if (Object.keys(updates).length > 0) {
          await supabase.from('funcionarios').update(updates).eq('id', funcId)
        }
      }

      // Verificar duplicidade
      const dataExame = converterData(d.aso?.data_exame) || new Date().toISOString().split('T')[0]
      const dupResp = await fetch('/api/verificar-duplicidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionario_id: funcId, tipo_aso: d.aso?.tipo_aso || 'periodico', data_exame: dataExame })
      })
      const dup = await dupResp.json()
      if (dup.duplicado) {
        const dataFmt = new Date(dup.data_exame + 'T12:00:00').toLocaleDateString('pt-BR')
        const msg = dup.jaTransmitido
          ? `⚠️ ASO já transmitido ao Gov.br em ${dataFmt}.\n\nSalvar como retificação?`
          : `⚠️ Já existe ASO ${dup.tipo_aso} em ${dataFmt}.\n\nSalvar mesmo assim?`
        if (!confirm(msg)) { setEtapa('preview'); return }
      }

      const { data: aso, error: asoErr } = await supabase.from('asos').insert({
        funcionario_id: funcId, empresa_id: empresaId,
        tipo_aso: d.aso?.tipo_aso || 'periodico',
        data_exame: dataExame,
        prox_exame: converterData(d.aso?.prox_exame) || null,
        conclusao: d.aso?.conclusao || 'apto',
        medico_nome: d.aso?.medico_nome || null,
        medico_crm: d.aso?.medico_crm || null,
        exames: d.exames || [],
        riscos: d.riscos || [],
      }).select().single()
      if (asoErr) throw new Error(asoErr.message)

      await supabase.from('transmissoes').insert({
        empresa_id: empresaId, funcionario_id: funcId,
        evento: 'S-2220', referencia_id: aso.id, referencia_tipo: 'aso',
        status: 'pendente', tentativas: 0, ambiente: 'producao_restrita',
      })
      setEtapa('sucesso')
    } catch (err) {
      setErro('Erro ao salvar: ' + err.message)
      setEtapa('preview')
    }
  }

  function converterData(br) {
    if (!br) return null
    if (br.includes('-') && !br.includes('/')) return br.substring(0,10)
    const p = br.split('/')
    return p.length === 3 ? `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` : null
  }

  function corConf(v) { return !v || v < 70 ? '#E24B4A' : v < 90 ? '#EF9F27' : '#1D9E75' }

  const tipoLabel = tipoDetectado === 'ltcat' ? 'LTCAT (S-2240)' : tipoDetectado === 'pcmso' ? 'PCMSO (NR-7)' : 'ASO (S-2220)'
  const tipoColor = tipoDetectado === 'ltcat' ? '#854F0B' : tipoDetectado === 'pcmso' ? '#27500A' : '#185FA5'
  const tipoBg    = tipoDetectado === 'ltcat' ? '#FAEEDA' : tipoDetectado === 'pcmso' ? '#EAF3DE' : '#E6F1FB'

  return (
    <Layout pagina="leitor">
      <Head><title>Leitor de Documentos — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>Leitor inteligente de documentos</div>
          <div style={s.sub}>
            {tipoFixo === 'aso'   && 'ASO — PDF ou XML → extrair → confirmar → salvar'}
            {tipoFixo === 'ltcat' && 'LTCAT — PDF → extrair GHEs e agentes → confirmar → salvar'}
            {tipoFixo === 'pcmso' && 'PCMSO — PDF → extrair programas e exames → confirmar → salvar'}
          </div>
        </div>
        {tipoDetectado && (
          <span style={{ padding:'4px 14px', borderRadius:99, fontSize:12, fontWeight:600, background:tipoBg, color:tipoColor }}>
            {tipoLabel} detectado
          </span>
        )}
      </div>

      {erro && <div style={s.erroBox}><strong>Erro:</strong> {erro}</div>}

      {/* UPLOAD */}
      {etapa === 'upload' && (
        <div style={s.card}>
          <div style={s.dropZone}
            onClick={() => inputRef.current.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='#185FA5' }}
            onDragLeave={e => { e.currentTarget.style.borderColor='#d1d5db' }}
            onDrop={e => {
              e.preventDefault(); e.currentTarget.style.borderColor='#d1d5db'
              const f = e.dataTransfer.files[0]; if(f) setArquivo(f)
            }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            <div style={{ fontSize:14, fontWeight:500, color:'#374151', marginTop:10 }}>
              {arquivo ? arquivo.name : 'Clique ou arraste o arquivo aqui'}
            </div>
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>
              PDF de ASO ou LTCAT · XML eSocial · Detectado automaticamente
            </div>
            {arquivo && (
              <div style={{ marginTop:8, fontSize:12, color:'#185FA5', fontWeight:500 }}>
                ✓ {arquivo.name} ({(arquivo.size/1024).toFixed(0)} KB) — pronto
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept={tipoFixo === "aso" ? ".pdf,.xml" : ".pdf"} style={{ display:'none' }}
            onChange={e => setArquivo(e.target.files[0])} />

          {arquivo && (
            <button style={{ ...s.btnPrimary, marginTop:12, width:'100%', fontSize:14 }}
              onClick={processarArquivo}>
              Ler documento com IA →
            </button>
          )}

          <div style={{ marginTop:12, padding:'10px 14px', background:'#f9fafb', borderRadius:8, fontSize:12, color:'#6b7280', lineHeight:1.9 }}>
            <strong>Detecção automática:</strong> o sistema identifica se é ASO ou LTCAT pelo conteúdo do documento —
            não precisa selecionar. PDF digital → extração direta · PDF escaneado → análise visual com IA · XML eSocial → leitura direta
          </div>
        </div>
      )}

      {/* LENDO */}
      {etapa === 'lendo' && (
        <div style={{ ...s.card, textAlign:'center', padding:'3rem' }}>
          <div style={{ width:48, height:48, border:'3px solid #185FA5', borderTopColor:'transparent', borderRadius:'50%', margin:'0 auto 14px', animation:'spin 1s linear infinite' }}></div>
          <div style={{ fontSize:14, fontWeight:500, color:'#111', marginBottom:4 }}>Processando documento...</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>{progresso}</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* PREVIEW */}
      {etapa === 'preview' && dadosEditados && (
        <div style={{ ...s.card, border:`1.5px solid ${tipoColor}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>
              Dados extraídos — edite se necessário e confirme
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:tipoBg, color:tipoColor }}>
                {tipoLabel}
              </span>
              <span style={{ fontSize:10, color:'#9ca3af' }}>
                {modoLeitura === 'texto' ? '📄 PDF digital' : modoLeitura === 'XML' ? '🔧 XML' : '📷 PDF escaneado'}
              </span>
            </div>
          </div>

          {/* ASO — Funcionário */}
          {tipoDetectado === 'aso' && dadosEditados.funcionario && (
            <div style={{ marginBottom:16 }}>
              <div style={s.secLabel}>Funcionário</div>
              {funcMatch ? (
                <div style={{ background:'#EAF3DE', border:'0.5px solid #9FE1CB', borderRadius:8, padding:'9px 12px', fontSize:12, color:'#085041', marginBottom:10, display:'flex', justifyContent:'space-between' }}>
                  <span>✓ Encontrado: <strong>{funcMatch.nome}</strong> — {funcMatch.cpf}</span>
                  <button onClick={() => setFuncMatch(null)} style={{ fontSize:11, color:'#E24B4A', background:'none', border:'none', cursor:'pointer' }}>Trocar</button>
                </div>
              ) : (
                <div style={{ marginBottom:10 }}>
                  <div style={{ background:'#FAEEDA', border:'0.5px solid #FAC775', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#633806', marginBottom:6 }}>
                    CPF não encontrado no cadastro — selecione um existente ou será criado novo.
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
                {campoEdit('Setor', dadosEditados.funcionario.setor, 70, v => atualizarCampo('funcionario.setor', v))}
              </div>
            </div>
          )}

          {/* ASO — Dados */}
          {tipoDetectado === 'aso' && dadosEditados.aso && (
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

          {/* ASO — Exames com T27 */}
          {tipoDetectado === 'aso' && dadosEditados.exames?.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={s.secLabel}>Exames ({dadosEditados.exames.length}) — Tabela 27 eSocial</div>
                <span style={{ fontSize:10, color:'#9ca3af' }}>Código obrigatório na transmissão</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {dadosEditados.exames.map((ex, i) => {
                  const bg = ex.resultado==='Normal'?'#EAF3DE':ex.resultado==='Alterado'?'#FCEBEB':'#FAEEDA'
                  const cor = ex.resultado==='Normal'?'#085041':ex.resultado==='Alterado'?'#791F1F':'#633806'
                  return (
                    <div key={i} style={{ padding:'4px 10px', borderRadius:8, fontSize:11, fontWeight:500, background:bg, color:cor, display:'flex', alignItems:'center', gap:6 }}>
                      <span>{ex.nome}: {ex.resultado}</span>
                      {ex.codigo_t27 && <span style={{ padding:'1px 5px', borderRadius:99, fontSize:9, fontWeight:700, background:'rgba(0,0,0,0.1)', fontFamily:'monospace' }}>T27:{ex.codigo_t27}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ASO — Riscos com T24 */}
          {tipoDetectado === 'aso' && (dadosEditados.riscos_codificados?.length > 0 || dadosEditados.riscos?.length > 0) && (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={s.secLabel}>Riscos — Tabela 24 eSocial (Aposentadoria Especial)</div>
                <span style={{ fontSize:10, color:'#9ca3af' }}>Obrigatório no S-2240</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {(dadosEditados.riscos_codificados || dadosEditados.riscos?.map(r=>({nome:r,codigo_t24:'09.01.001',tipo:'aus'}))).map((r,i) => {
                  const COR = { fis:['#E6F1FB','#0C447C'], qui:['#FAEEDA','#633806'], bio:['#EAF3DE','#27500A'], aus:['#f3f4f6','#6b7280'], out:['#FAEEDA','#633806'] }
                  const [bg,cor] = COR[r.tipo]||['#f3f4f6','#374151']
                  return (
                    <div key={i} style={{ padding:'4px 10px', borderRadius:8, fontSize:11, fontWeight:500, background:bg, color:cor, display:'flex', alignItems:'center', gap:6 }}>
                      <span>{r.nome}</span>
                      <span style={{ padding:'1px 5px', borderRadius:99, fontSize:9, fontWeight:700, background:'rgba(0,0,0,0.1)', fontFamily:'monospace' }}>T24:{r.codigo_t24}</span>
                    </div>
                  )
                })}
              </div>
              {(dadosEditados.riscos_codificados||[]).some(r => r.codigo_t24 && !r.codigo_t24.startsWith('09')) && (
                <div style={{ marginTop:6, fontSize:11, color:'#E24B4A', fontWeight:500 }}>
                  ⚠ Agentes nocivos identificados — trabalhador pode ter direito à aposentadoria especial.
                </div>
              )}
            </div>
          )}

          {/* LTCAT — Dados gerais */}
          {tipoDetectado === 'ltcat' && dadosEditados.dados_gerais && (
            <div style={{ marginBottom:16 }}>
              <div style={s.secLabel}>Dados gerais do LTCAT</div>
              <div style={{ background:'#FAEEDA', border:'0.5px solid #FAC775', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#633806', marginBottom:10 }}>
                O responsável técnico (Eng. de Segurança ou Médico do Trabalho) não precisa estar cadastrado como funcionário.
              </div>
              <div style={s.grid2}>
                {campoEdit('Data emissão', dadosEditados.dados_gerais.data_emissao, dadosEditados.confianca?.data_emissao, v => atualizarCampo('dados_gerais.data_emissao', v))}
                {campoEdit('Data vigência', dadosEditados.dados_gerais.data_vigencia, 80, v => atualizarCampo('dados_gerais.data_vigencia', v))}
                {campoEdit('Próxima revisão', dadosEditados.dados_gerais.prox_revisao, 75, v => atualizarCampo('dados_gerais.prox_revisao', v))}
                {campoEdit('Responsável técnico', dadosEditados.dados_gerais.resp_nome, dadosEditados.confianca?.resp_nome, v => atualizarCampo('dados_gerais.resp_nome', v))}
                {campoEdit('Conselho (CREA/CRM)', dadosEditados.dados_gerais.resp_conselho, 85, v => atualizarCampo('dados_gerais.resp_conselho', v))}
                {campoEdit('Nº Registro', dadosEditados.dados_gerais.resp_registro, 85, v => atualizarCampo('dados_gerais.resp_registro', v))}
              </div>
              {dadosEditados.ghes?.length > 0 && (
                <div style={{ marginTop:8, padding:'8px 12px', background:'#f9fafb', borderRadius:8, fontSize:12, color:'#374151' }}>
                  {dadosEditados.ghes.length} GHE(s) identificado(s) com {dadosEditados.ghes.reduce((a,g)=>a+(g.agentes?.length||0),0)} agente(s) de risco
                </div>
              )}
            </div>
          )}

          <div style={{ display:'flex', gap:10, marginTop:8 }}>
            <button style={s.btnPrimary} onClick={salvar}>Confirmar e salvar →</button>
            <button style={s.btnOutline} onClick={() => { setEtapa('upload'); setDados(null); setArquivo(null); setFuncMatch(null); setTipoDetectado('') }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* SALVANDO */}
      {etapa === 'salvando' && (
        <div style={{ ...s.card, textAlign:'center', padding:'3rem' }}>
          <div style={{ fontSize:14, fontWeight:500, color:'#111' }}>Salvando no banco...</div>
        </div>
      )}

      {/* SUCESSO */}
      {etapa === 'sucesso' && (
        <div style={{ ...s.card, textAlign:'center', padding:'3rem' }}>
          <div style={{ width:56, height:56, background:'#EAF3DE', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style={{ fontSize:15, fontWeight:600, color:'#085041', marginBottom:6 }}>Salvo com sucesso!</div>
          <div style={{ fontSize:13, color:'#374151', marginBottom:20 }}>
            {tipoDetectado === 'ltcat' ? 'LTCAT salvo.' : tipoDetectado === 'pcmso' ? 'PCMSO identificado. Use a página PCMSO para cadastrar os programas.' : 'ASO salvo e transmissão registrada como pendente.'}
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button style={s.btnPrimary} onClick={() => { setEtapa('upload'); setDados(null); setArquivo(null); setFuncMatch(null); setTipoDetectado('') }}>
              Ler outro documento
            </button>
            <button style={s.btnOutline} onClick={() => router.push(tipoDetectado==='ltcat'?'/ltcat':tipoDetectado==='pcmso'?'/pcmso':'/relatorios')}>
              {tipoDetectado === 'ltcat' ? 'Ver LTCAT →' : tipoDetectado === 'pcmso' ? 'Ver PCMSO →' : 'Ver relatórios →'}
            </button>
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
          <span style={{ width:7, height:7, borderRadius:'50%', background:cor, flexShrink:0 }} title={`Confiança: ${confianca||0}%`}></span>
        </div>
        <input style={{ ...s.input, borderColor: cor+'66' }} defaultValue={valor||''} onChange={e => onChange(e.target.value)} />
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
  secLabel: { fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 },
  grid2:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  input:    { width:'100%', padding:'7px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:7, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' },
  erroBox:  { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12, lineHeight:1.6 },
  btnPrimary: { padding:'10px 20px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnOutline: { padding:'10px 20px', background:'transparent', color:'#374151', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer' },
}
