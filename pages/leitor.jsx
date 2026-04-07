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

  // Carrega pdf.js dinamicamente
  async function carregarPDFJS() {
    if (window.pdfjsLib) return window.pdfjsLib
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    return window.pdfjsLib
  }

  // Extrai texto do PDF (funciona para PDFs digitais)
  async function extrairTextoPDF(file) {
    const pdfjsLib = await carregarPDFJS()
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let textoCompleto = ''
    const total = Math.min(pdf.numPages, 6)
    for (let i = 1; i <= total; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const textoPage = content.items.map(item => item.str).join(' ')
      textoCompleto += textoPage + '\n'
    }
    return textoCompleto.trim()
  }

  // Converte páginas em imagens (para PDFs escaneados)
  async function pdfParaImagens(file) {
    const pdfjsLib = await carregarPDFJS()
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const paginas = []
    const total = Math.min(pdf.numPages, 3)
    for (let i = 1; i <= total; i++) {
      setProgresso(`Convertendo página ${i} de ${total}...`)
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      paginas.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
    }
    return paginas
  }

  // Lê XML eSocial
  async function lerXML(file) {
    const texto = await file.text()
    const doc = new DOMParser().parseFromString(texto, 'text/xml')
    const get = tag => doc.querySelector(tag)?.textContent?.trim() || null
    const tipoMap = { '0':'admissional','1':'periodico','2':'retorno','3':'mudanca','4':'demissional','5':'monitoracao' }
    const concMap = { '1':'apto','2':'apto_restricao','3':'inapto' }
    return {
      funcionario: { nome: get('nmTrab'), cpf: get('cpfTrab'), matricula: get('matricula'), funcao: null, setor: null, data_nasc: null, data_adm: null },
      aso: {
        tipo_aso: tipoMap[get('tpAso')] || 'periodico',
        data_exame: formatarData(get('dtAso')),
        prox_exame: null,
        conclusao: concMap[get('concl')] || 'apto',
        medico_nome: get('nmMed'),
        medico_crm: get('nrCRM'),
      },
      exames: [], riscos: [],
      confianca: { nome:99, cpf:99, tipo_aso:99, data_exame:99, conclusao:99 }
    }
  }

  function formatarData(iso) {
    if (!iso || iso.length < 10) return null
    const [y,m,d] = iso.substring(0,10).split('-')
    return `${d}/${m}/${y}`
  }

  async function processarArquivo() {
    if (!arquivo) return
    setErro(''); setEtapa('lendo')

    try {
      // XML — leitura direta
      if (arquivo.name.toLowerCase().endsWith('.xml')) {
        setProgresso('Lendo XML eSocial...')
        const dadosXML = await lerXML(arquivo)
        finalizarLeitura(dadosXML, 'XML')
        return
      }

      // PDF — tenta texto primeiro
      setProgresso('Analisando PDF...')
      const texto = await extrairTextoPDF(arquivo)
      const temTexto = texto.replace(/\s/g, '').length > 100

      let payload

      if (temTexto) {
        // PDF digital — manda texto
        setProgresso('PDF digital detectado. Extraindo dados com IA...')
        setModoLeitura('texto')
        payload = { texto_pdf: texto, paginas: [], tipo: tipoDoc }
      } else {
        // PDF escaneado — converte em imagens
        setProgresso('PDF escaneado detectado. Convertendo em imagens...')
        setModoLeitura('imagem')
        const paginas = await pdfParaImagens(arquivo)
        setProgresso(`Analisando ${paginas.length} página(s) com IA...`)
        payload = { paginas, texto_pdf: '', tipo: tipoDoc }
      }

      const resp = await fetch('/api/ler-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await resp.json()

      if (!resp.ok || !json.sucesso) {
        // Mostra debug se disponível
        const msg = json.debug
          ? `${json.erro}\n\nResposta bruta: ${json.debug}`
          : json.erro
        throw new Error(msg)
      }

      finalizarLeitura(json.dados, json.modo)

    } catch (err) {
      setErro(err.message)
      setEtapa('upload')
    }
  }

  function finalizarLeitura(dadosExtraidos, modo) {
    if (dadosExtraidos.funcionario?.cpf) {
      const cpfLimpo = dadosExtraidos.funcionario.cpf.replace(/\D/g, '')
      const match = funcionarios.find(f => f.cpf.replace(/\D/g, '') === cpfLimpo)
      if (match) setFuncMatch(match)
    }
    setDados(dadosExtraidos)
    setModoLeitura(modo)
    setEtapa('preview')
  }

  async function salvar() {
    setEtapa('salvando')
    try {
      let funcId = funcMatch?.id
      if (!funcId && dados.funcionario?.nome) {
        const { data: novoFunc } = await supabase.from('funcionarios').insert({
          empresa_id: empresaId,
          nome: dados.funcionario.nome || 'Não identificado',
          cpf: dados.funcionario.cpf || '000.000.000-00',
          data_nasc: converterData(dados.funcionario.data_nasc) || '1990-01-01',
          data_adm: converterData(dados.funcionario.data_adm) || new Date().toISOString().split('T')[0],
          matricula_esocial: dados.funcionario.matricula || ('AUTO-' + Date.now()),
          funcao: dados.funcionario.funcao,
          setor: dados.funcionario.setor,
        }).select().single()
        funcId = novoFunc?.id
      }
      if (!funcId) throw new Error('Selecione um funcionário.')

      if (tipoDoc === 'aso') {
        const { data: aso } = await supabase.from('asos').insert({
          funcionario_id: funcId, empresa_id: empresaId,
          tipo_aso: dados.aso?.tipo_aso || 'periodico',
          data_exame: converterData(dados.aso?.data_exame) || new Date().toISOString().split('T')[0],
          prox_exame: converterData(dados.aso?.prox_exame) || null,
          conclusao: dados.aso?.conclusao || 'apto',
          medico_nome: dados.aso?.medico_nome || null,
          medico_crm: dados.aso?.medico_crm || null,
          exames: dados.exames || [],
          riscos: dados.riscos || [],
        }).select().single()
        await supabase.from('transmissoes').insert({
          empresa_id: empresaId, funcionario_id: funcId,
          evento: 'S-2220', referencia_id: aso.id, referencia_tipo: 'aso',
          status: 'pendente', tentativas: 0, ambiente: 'producao_restrita',
        })
      } else {
        const { data: ltcat } = await supabase.from('ltcats').insert({
          empresa_id: empresaId,
          data_emissao: converterData(dados.dados_gerais?.data_emissao) || new Date().toISOString().split('T')[0],
          data_vigencia: converterData(dados.dados_gerais?.data_vigencia) || new Date().toISOString().split('T')[0],
          prox_revisao: converterData(dados.dados_gerais?.prox_revisao) || null,
          resp_nome: dados.dados_gerais?.resp_nome || '',
          resp_conselho: dados.dados_gerais?.resp_conselho || 'CREA',
          resp_registro: dados.dados_gerais?.resp_registro || null,
          ghes: dados.ghes || [], ativo: true,
        }).select().single()
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

  function corConfianca(v) {
    if (!v || v < 70) return '#E24B4A'
    if (v < 90) return '#EF9F27'
    return '#1D9E75'
  }

  return (
    <Layout pagina="leitor">
      <Head><title>Leitor Inteligente — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>Leitor inteligente de documentos</div>
          <div style={s.sub}>PDF ou XML → campos extraídos automaticamente → confirmar → salvar</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {['aso','ltcat'].map(t => (
            <button key={t} onClick={() => setTipoDoc(t)} style={{
              padding:'6px 14px', borderRadius:99, fontSize:12, fontWeight:500, cursor:'pointer', border:'none',
              background: tipoDoc===t ? (t==='aso'?'#185FA5':'#EF9F27') : '#f3f4f6',
              color: tipoDoc===t ? '#fff' : '#6b7280',
            }}>{t==='aso'?'ASO (S-2220)':'LTCAT (S-2240)'}</button>
          ))}
        </div>
      </div>

      {erro && (
        <div style={s.erroBox}>
          <strong>Erro:</strong> {erro.split('\n')[0]}
          {erro.includes('bruta') && (
            <details style={{ marginTop:6, fontSize:11 }}>
              <summary style={{ cursor:'pointer' }}>Ver resposta bruta</summary>
              <pre style={{ marginTop:4, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{erro.split('\n').slice(2).join('\n')}</pre>
            </details>
          )}
        </div>
      )}

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
            {arquivo && <div style={{ marginTop:8, fontSize:12, color:'#185FA5', fontWeight:500 }}>✓ {arquivo.name} ({(arquivo.size/1024).toFixed(0)} KB)</div>}
          </div>
          <input ref={inputRef} type="file" accept=".pdf,.xml" style={{ display:'none' }}
            onChange={e => setArquivo(e.target.files[0])} />
          {arquivo && (
            <button style={{ ...s.btnPrimary, marginTop:12, width:'100%' }} onClick={processarArquivo}>
              Ler documento com IA →
            </button>
          )}
          <div style={{ marginTop:14, padding:'12px 14px', background:'#f9fafb', borderRadius:8, fontSize:12, color:'#6b7280', lineHeight:1.9 }}>
            <strong>Como funciona:</strong><br/>
            • PDF digital (gerado no computador): extração de texto direta — rápida e precisa<br/>
            • PDF escaneado (foto/scan): conversão em imagem + análise visual com IA<br/>
            • XML eSocial: leitura direta dos campos estruturados
          </div>
        </div>
      )}

      {etapa === 'lendo' && (
        <div style={{ ...s.card, textAlign:'center', padding:'3rem' }}>
          <div style={{ width:50, height:50, border:'3px solid #185FA5', borderTopColor:'transparent', borderRadius:'50%', margin:'0 auto 16px', animation:'spin 1s linear infinite' }}></div>
          <div style={{ fontSize:14, fontWeight:500, color:'#111', marginBottom:6 }}>Processando documento...</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>{progresso}</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {etapa === 'preview' && dados && (
        <div style={{ ...s.card, border:'1.5px solid #1D9E75' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#085041' }}>Dados extraídos — confira e corrija se necessário</div>
            <span style={{ fontSize:11, background:'#E6F1FB', color:'#0C447C', padding:'2px 10px', borderRadius:99, fontWeight:500 }}>
              {modoLeitura === 'texto' ? 'PDF digital' : modoLeitura === 'XML' ? 'XML eSocial' : 'PDF escaneado'}
            </span>
          </div>

          {tipoDoc === 'aso' && dados.funcionario && (
            <div style={{ marginBottom:14 }}>
              <div style={s.secLabel}>Funcionário</div>
              {funcMatch ? (
                <div style={{ background:'#EAF3DE', border:'0.5px solid #9FE1CB', borderRadius:8, padding:'9px 12px', fontSize:12, color:'#085041', marginBottom:10 }}>
                  ✓ Encontrado no cadastro: <strong>{funcMatch.nome}</strong>
                  <button onClick={() => setFuncMatch(null)} style={{ marginLeft:10, fontSize:11, color:'#E24B4A', background:'none', border:'none', cursor:'pointer' }}>Trocar</button>
                </div>
              ) : (
                <div style={{ marginBottom:10 }}>
                  <div style={{ background:'#FAEEDA', border:'0.5px solid #FAC775', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#633806', marginBottom:6 }}>
                    CPF não encontrado no cadastro. Selecione ou será criado novo.
                  </div>
                  <select style={s.input} onChange={e => setFuncMatch(funcionarios.find(f=>f.id===e.target.value)||null)}>
                    <option value="">— criar novo com dados do documento —</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.cpf}</option>)}
                  </select>
                </div>
              )}
              <div style={s.grid2}>
                {campo('Nome', dados.funcionario.nome, dados.confianca?.nome)}
                {campo('CPF', dados.funcionario.cpf, dados.confianca?.cpf)}
                {campo('Função', dados.funcionario.funcao, 70)}
                {campo('Setor', dados.funcionario.setor, 70)}
              </div>
            </div>
          )}

          {tipoDoc === 'aso' && dados.aso && (
            <div style={{ marginBottom:14 }}>
              <div style={s.secLabel}>Dados do ASO</div>
              <div style={s.grid2}>
                {campo('Tipo', dados.aso.tipo_aso, dados.confianca?.tipo_aso)}
                {campo('Conclusão', dados.aso.conclusao, dados.confianca?.conclusao)}
                {campo('Data do exame', dados.aso.data_exame, dados.confianca?.data_exame)}
                {campo('Próximo exame', dados.aso.prox_exame, 75)}
                {campo('Médico', dados.aso.medico_nome, 80)}
                {campo('CRM', dados.aso.medico_crm, dados.confianca?.medico_crm)}
              </div>
            </div>
          )}

          {tipoDoc === 'aso' && dados.exames?.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={s.secLabel}>Exames ({dados.exames.length})</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {dados.exames.map((ex, i) => (
                  <span key={i} style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:500,
                    background: ex.resultado==='Normal'?'#EAF3DE':ex.resultado==='Alterado'?'#FCEBEB':'#FAEEDA',
                    color: ex.resultado==='Normal'?'#085041':ex.resultado==='Alterado'?'#791F1F':'#633806' }}>
                    {ex.nome}: {ex.resultado}
                  </span>
                ))}
              </div>
            </div>
          )}

          {tipoDoc === 'ltcat' && dados.dados_gerais && (
            <div style={{ marginBottom:14 }}>
              <div style={s.secLabel}>Dados gerais do LTCAT</div>
              <div style={s.grid2}>
                {campo('Data emissão', dados.dados_gerais.data_emissao, dados.confianca?.data_emissao)}
                {campo('Próxima revisão', dados.dados_gerais.prox_revisao, 80)}
                {campo('Responsável', dados.dados_gerais.resp_nome, dados.confianca?.resp_nome)}
                {campo('Conselho/Registro', `${dados.dados_gerais.resp_conselho||''} ${dados.dados_gerais.resp_registro||''}`.trim(), 85)}
              </div>
              {dados.ghes?.length > 0 && (
                <div style={{ fontSize:12, color:'#374151', marginTop:8 }}>
                  {dados.ghes.length} GHE(s) · {dados.ghes.reduce((a,g)=>a+(g.agentes?.length||0),0)} agente(s) de risco
                </div>
              )}
            </div>
          )}

          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button style={s.btnPrimary} onClick={salvar}>Confirmar e salvar →</button>
            <button style={s.btnOutline} onClick={() => { setEtapa('upload'); setDados(null); setArquivo(null); setFuncMatch(null) }}>Cancelar</button>
          </div>
        </div>
      )}

      {etapa === 'salvando' && (
        <div style={{ ...s.card, textAlign:'center', padding:'3rem' }}>
          <div style={{ fontSize:14, fontWeight:500, color:'#111' }}>Salvando...</div>
        </div>
      )}

      {etapa === 'sucesso' && (
        <div style={{ ...s.card, textAlign:'center', padding:'3rem' }}>
          <div style={{ width:56, height:56, background:'#EAF3DE', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style={{ fontSize:15, fontWeight:600, color:'#085041', marginBottom:6 }}>Salvo com sucesso!</div>
          <div style={{ fontSize:13, color:'#374151', marginBottom:20 }}>Transmissão agendada como pendente.</div>
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button style={s.btnPrimary} onClick={() => { setEtapa('upload'); setDados(null); setArquivo(null); setFuncMatch(null) }}>Ler outro documento</button>
            <button style={s.btnOutline} onClick={() => router.push('/historico')}>Ver histórico →</button>
          </div>
        </div>
      )}
    </Layout>
  )

  function campo(label, valor, confianca) {
    const cor = corConfianca(confianca)
    return (
      <div key={label} style={{ marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
          <span style={{ fontSize:11, fontWeight:500, color:'#374151' }}>{label}</span>
          <span style={{ width:7, height:7, borderRadius:'50%', background:cor, display:'inline-block' }}></span>
        </div>
        <input style={{ ...s.input, borderColor: cor+'44' }} defaultValue={valor || ''} />
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
  input:    { width:'100%', padding:'7px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:7, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' },
  erroBox:  { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12, lineHeight:1.6 },
  btnPrimary: { padding:'10px 20px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnOutline: { padding:'10px 20px', background:'transparent', color:'#374151', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer' },
}
