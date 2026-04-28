import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { getEmpresaId } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TIPO_INFO = {
  ltcat: { label: 'LTCAT', cor: '#185FA5', bg: '#E6F1FB', icone: '🏭' },
  pcmso: { label: 'PCMSO', cor: '#27500A', bg: '#EAF3DE', icone: '🩺' },
  aso:   { label: 'ASO',   cor: '#633806', bg: '#FAEEDA', icone: '📋' },
}

const LIMITE_ARQUIVOS  = 50
const CONCORRENCIA     = 3
const LIMITE_BASE64    = 3 * 1024 * 1024
const LIMITE_TAMANHO   = 50 * 1024 * 1024

// ── Utilitários ──────────────────────────────────────────
function converterData(br) {
  if (!br) return null
  if (typeof br === 'string' && br.includes('-') && !br.includes('/')) return br.substring(0, 10)
  const p = String(br).split('/')
  return p.length === 3 ? `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` : null
}

function fmtTamanho(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const TIPOS_ASO_VALIDOS = ['admissional','periodico','retorno','mudanca','demissional','monitoracao']
const CONCLUSOES_VALIDAS = ['apto','inapto','apto_restricao']

function normalizarTipoAso(valor) {
  if (!valor) return 'periodico'
  const v = valor.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'')
  if (v.includes('admiss'))  return 'admissional'
  if (v.includes('demiss'))  return 'demissional'
  if (v.includes('retorn'))  return 'retorno'
  if (v.includes('mudan') || v.includes('funcao') || v.includes('cargo')) return 'mudanca'
  if (v.includes('monitor')) return 'monitoracao'
  if (v.includes('period') || v.includes('anual') || v.includes('bienal')) return 'periodico'
  if (TIPOS_ASO_VALIDOS.includes(v)) return v
  return 'periodico'
}

function normalizarConclusao(valor) {
  if (!valor) return 'apto'
  const v = valor.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z_]/g,'')
  if (v.includes('inapto')) return 'inapto'
  if (v.includes('restr') || v.includes('restricao') || v === 'apto_restricao') return 'apto_restricao'
  if (v.includes('apto')) return 'apto'
  if (CONCLUSOES_VALIDAS.includes(v)) return v
  return 'apto'
}

function fmtCPF(v) {
  return v.replace(/\D/g, '').substring(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

// ── PDF.js ────────────────────────────────────────────────
let pdfJsLoading = null
async function carregarPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib
  if (!pdfJsLoading) {
    pdfJsLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        resolve(window.pdfjsLib)
      }
      s.onerror = reject
      document.head.appendChild(s)
    })
  }
  return pdfJsLoading
}

// ── Extrai texto e chama API ──────────────────────────────
async function processarArquivo(file, onProgresso, token) {
  onProgresso('Carregando PDF...')
  const lib = await carregarPdfJs()
  const arrayBuf = await file.arrayBuffer()
  const pdfDoc = await lib.getDocument({ data: arrayBuf.slice(0) }).promise

  onProgresso('Extraindo texto...')
  let textoPdf = ''
  for (let i = 1; i <= Math.min(pdfDoc.numPages, 10); i++) {
    const page = await pdfDoc.getPage(i)
    const content = await page.getTextContent()
    textoPdf += content.items.map(it => it.str).join(' ') + '\n'
  }
  const temTexto = textoPdf.replace(/\s/g, '').length > 300

  let payload
  if (file.size <= LIMITE_BASE64) {
    onProgresso('Preparando leitura nativa...')
    const bytes = new Uint8Array(arrayBuf.slice(0))
    let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    payload = { pdf_base64: btoa(bin), texto_pdf: textoPdf, paginas: [], tipo: 'auto' }
  } else if (temTexto) {
    onProgresso(`PDF grande (${fmtTamanho(file.size)}) — usando texto...`)
    payload = { texto_pdf: textoPdf, paginas: [], tipo: 'auto' }
  } else {
    onProgresso('PDF escaneado — convertendo imagens...')
    const paginas = []
    for (let i = 1; i <= Math.min(pdfDoc.numPages, 5); i++) {
      onProgresso(`Convertendo página ${i}/${Math.min(pdfDoc.numPages, 5)}...`)
      const page = await pdfDoc.getPage(i)
      const vp = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      canvas.width = vp.width; canvas.height = vp.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
      paginas.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
    }
    payload = { paginas, texto_pdf: '', tipo: 'auto' }
  }

  onProgresso('Identificando com IA...')
  const resp = await fetch('/api/ler-documento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  })
  let json
  try { json = await resp.json() }
  catch { throw new Error('O servidor não respondeu. Tente novamente.') }
  if (!resp.ok || !json.sucesso) throw new Error(json.erro || 'Erro na análise do documento')
  return json
}

// ── Buscar funcionário por CPF (reativa se estiver inativo) ─
async function buscarFuncionario(cpf, empresaId) {
  const cpfBruto = (cpf || '').replace(/\D/g, '')
  if (cpfBruto.length !== 11) return null
  const cpfFmt = cpfBruto.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  const { data } = await supabase.from('funcionarios')
    .select('id, nome, ativo').eq('empresa_id', empresaId).eq('cpf', cpfFmt).single()
  if (!data) return null
  if (!data.ativo) {
    await supabase.from('funcionarios').update({ ativo: true }).eq('id', data.id)
  }
  return data
}

// ── Salvar ASO com funcionário já conhecido ───────────────
async function salvarAso(dados, funcId, empresaId) {
  const dataExame = converterData(dados.aso?.data_exame) || new Date().toISOString().split('T')[0]
  const { data: aso, error: asoErr } = await supabase.from('asos').insert({
    funcionario_id: funcId, empresa_id: empresaId,
    tipo_aso: normalizarTipoAso(dados.aso?.tipo_aso),
    data_exame: dataExame,
    prox_exame: converterData(dados.aso?.prox_exame) || null,
    conclusao: normalizarConclusao(dados.aso?.conclusao),
    medico_nome: dados.aso?.medico_nome || null,
    medico_crm: dados.aso?.medico_crm || null,
    exames: dados.exames || [],
    riscos: dados.riscos || [],
  }).select().single()
  if (asoErr) throw new Error(asoErr.message)
  await supabase.from('transmissoes').insert({
    empresa_id: empresaId, funcionario_id: funcId,
    evento: 'S-2220', referencia_id: aso.id, referencia_tipo: 'aso',
    status: 'pendente', tentativas: 0, ambiente: 'producao_restrita',
  })
}

// ── Salvar LTCAT / PCMSO ──────────────────────────────────
async function salvarDocumento(tipo, dados, empresaId) {
  if (tipo === 'ltcat') {
    const { error } = await supabase.from('ltcats').insert({
      empresa_id: empresaId,
      data_emissao: dados.dados_gerais?.data_emissao || null,
      data_vigencia: dados.dados_gerais?.data_vigencia || null,
      prox_revisao: dados.dados_gerais?.prox_revisao || null,
      resp_nome: dados.dados_gerais?.resp_nome || null,
      resp_conselho: dados.dados_gerais?.resp_conselho || 'CREA',
      resp_registro: dados.dados_gerais?.resp_registro || null,
      ghes: dados.ghes || [],
      ativo: true,
    })
    if (error) throw new Error(error.message)
    return
  }
  if (tipo === 'pcmso') {
    for (const prog of (dados.programas || [])) {
      await supabase.from('pcmso_programa').upsert({
        empresa_id: empresaId, funcao: prog.funcao, setor: prog.setor || null,
        riscos: prog.riscos || [],
        exames: (prog.exames || []).map(e => ({
          nome: typeof e === 'string' ? e : e.nome,
          periodicidade: e.periodicidade || 'Anual', obrigatorio: true,
        })),
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'empresa_id,funcao' })
    }
    return
  }
  throw new Error('Tipo inválido para salvarDocumento')
}

function resumoDocumento(tipo, dados) {
  if (tipo === 'aso')   return `${dados.funcionario?.nome || '—'} · ${dados.aso?.tipo_aso || '—'}`
  if (tipo === 'ltcat') return `${dados.ghes?.length || 0} GHEs · ${dados.dados_gerais?.resp_nome || '—'}`
  if (tipo === 'pcmso') return `${dados.programas?.length || 0} programas`
  return ''
}

// ════════════════════════════════════════════════════════
// Componente principal
// ════════════════════════════════════════════════════════
export default function Importar() {
  const router = useRouter()
  const fileRef = useRef()
  const [empresaId, setEmpresaId] = useState('')
  const [sessionToken, setSessionToken] = useState('')
  const [fila, setFila] = useState([])
  const [processando, setProcessando] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [erroGlobal, setErroGlobal] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setSessionToken(session.access_token)
      supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
        .then(({ data: u }) => {
          if (!u) { router.push('/login'); return }
          setEmpresaId(getEmpresaId() || u.empresa_id)
        })
    })
  }, [])

  function atualizarItem(id, patch) {
    setFila(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
  }

  function adicionarArquivos(files) {
    setErroGlobal('')
    const validos = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (validos.length === 0) { setErroGlobal('Selecione arquivos PDF.'); return }

    setFila(prev => {
      const vagos = LIMITE_ARQUIVOS - prev.length
      if (vagos <= 0) { setErroGlobal(`Limite de ${LIMITE_ARQUIVOS} arquivos atingido.`); return prev }
      const novos = validos.slice(0, vagos).map(f => {
        if (f.size > LIMITE_TAMANHO) {
          return { id: uid(), nome: f.name, tamanho: f.size, file: null, estado: 'erro', tipo: null, info: null, erro: `Arquivo muito grande (${fmtTamanho(f.size)}). Máximo: 50 MB.` }
        }
        return { id: uid(), nome: f.name, tamanho: f.size, file: f, estado: 'aguardando', tipo: null, info: null, erro: null }
      })
      if (validos.length > vagos) setErroGlobal(`Apenas ${vagos} adicionado(s). Limite: ${LIMITE_ARQUIVOS}.`)
      return [...prev, ...novos]
    })
  }

  function removerItem(id) {
    if (processando) return
    setFila(prev => prev.filter(it => it.id !== id))
  }

  // ── Processa um único item ─────────────────────────────
  async function processarUmItem(item, empId) {
    atualizarItem(item.id, { estado: 'processando', progresso: 'Iniciando...' })
    try {
      const resultado = await processarArquivo(item.file, msg =>
        atualizarItem(item.id, { progresso: msg }), sessionToken
      )
      const { tipo_detectado, dados } = resultado

      if (!tipo_detectado || !TIPO_INFO[tipo_detectado]) {
        throw new Error(
          `Tipo de documento não reconhecido pela IA${tipo_detectado ? ` ("${tipo_detectado}")` : ''}. ` +
          'Certifique-se que o PDF é um ASO, LTCAT ou PCMSO válido e tente novamente.'
        )
      }

      if (tipo_detectado === 'aso') {
        atualizarItem(item.id, { progresso: 'Verificando funcionário...' })
        const func = await buscarFuncionario(dados.funcionario?.cpf, empId)

        if (func) {
          atualizarItem(item.id, { progresso: 'Salvando ASO...' })
          await salvarAso(dados, func.id, empId)
          atualizarItem(item.id, {
            estado: 'salvo', tipo: 'aso', info: TIPO_INFO.aso,
            resumo: `${func.nome} · ${dados.aso?.tipo_aso || 'periódico'}`,
            progresso: null,
          })
        } else {
          atualizarItem(item.id, {
            estado: 'confirmar_func',
            tipo: 'aso', info: TIPO_INFO.aso,
            dadosResultado: resultado,
            formFunc: {
              nome:      dados.funcionario?.nome     || '',
              cpf:       dados.funcionario?.cpf      || '',
              data_nasc: converterData(dados.funcionario?.data_nasc) || '',
              data_adm:  converterData(dados.funcionario?.data_adm)  || '',
              funcao:    dados.funcionario?.funcao   || '',
              setor:     dados.funcionario?.setor    || '',
            },
            progresso: null,
            expandido: true,
          })
        }
      } else {
        atualizarItem(item.id, { progresso: 'Salvando...' })
        await salvarDocumento(tipo_detectado, dados, empId)
        atualizarItem(item.id, {
          estado: 'salvo', tipo: tipo_detectado, info: TIPO_INFO[tipo_detectado],
          resumo: resumoDocumento(tipo_detectado, dados), progresso: null,
        })
      }
    } catch (err) {
      atualizarItem(item.id, { estado: 'erro', erro: err.message, progresso: null })
    }
  }

  // ── Processamento em lote com concorrência limitada ───
  async function processarFila() {
    if (!empresaId || processando) return
    const pendentes = fila.filter(it => it.estado === 'aguardando' && it.file)
    if (pendentes.length === 0) return
    setProcessando(true)

    // Divide em fatias de CONCORRENCIA (3) e processa cada fatia em paralelo
    for (let i = 0; i < pendentes.length; i += CONCORRENCIA) {
      const fatia = pendentes.slice(i, i + CONCORRENCIA)
      await Promise.all(fatia.map(item => processarUmItem(item, empresaId)))
    }

    setProcessando(false)
  }

  // ── Confirmar funcionário novo e salvar ASO ────────────
  async function confirmarESalvar(itemId) {
    const item = fila.find(it => it.id === itemId)
    if (!item) return
    const f = item.formFunc
    if (!f.nome.trim() || !f.cpf.trim()) {
      atualizarItem(itemId, { erroForm: 'Nome e CPF são obrigatórios.' }); return
    }

    atualizarItem(itemId, { salvandoConfirmacao: true, erroForm: null })
    try {
      // Cria o funcionário
      const cpfFmt = fmtCPF(f.cpf)
      const { data: novoFunc, error: funcErr } = await supabase.from('funcionarios').insert({
        empresa_id: empresaId,
        nome: f.nome.trim(), cpf: cpfFmt,
        data_nasc: f.data_nasc || null, data_adm: f.data_adm || null,
        matricula_esocial: 'PEND-' + Date.now(),
        funcao: f.funcao.trim() || null, setor: f.setor.trim() || null,
        ativo: true,
      }).select().single()
      if (funcErr) throw new Error('Erro ao cadastrar: ' + funcErr.message)

      // Salva o ASO
      await salvarAso(item.dadosResultado.dados, novoFunc.id, empresaId)

      atualizarItem(itemId, {
        estado: 'salvo', salvandoConfirmacao: false, expandido: false,
        resumo: `${novoFunc.nome} · ${item.dadosResultado.dados.aso?.tipo_aso || 'periódico'} · funcionário cadastrado`,
      })
    } catch (err) {
      atualizarItem(itemId, { salvandoConfirmacao: false, erroForm: err.message })
    }
  }

  function pularItem(itemId) {
    atualizarItem(itemId, { estado: 'erro', erro: 'Pulado pelo usuário.', expandido: false })
  }

  const totalAguardando    = fila.filter(it => it.estado === 'aguardando').length
  const totalSalvos        = fila.filter(it => it.estado === 'salvo').length
  const totalErros         = fila.filter(it => it.estado === 'erro').length
  const totalConfirmacao   = fila.filter(it => it.estado === 'confirmar_func').length
  const totalFila          = fila.length

  function navegar() {
    const tipos = [...new Set(fila.filter(it => it.estado === 'salvo').map(it => it.tipo))]
    if (tipos.length === 1) router.push(`/${tipos[0]}`)
    else router.push('/dashboard')
  }

  return (
    <Layout pagina="importar">
      <Head><title>Importar Documentos — eSocial SST</title></Head>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>Importar Documentos</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Até {LIMITE_ARQUIVOS} PDFs por vez · {CONCORRENCIA} processados em paralelo — ASO, LTCAT ou PCMSO detectados automaticamente
          </div>
        </div>

        {/* Zona de drop */}
        {!processando && totalFila < LIMITE_ARQUIVOS && (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); adicionarArquivos(e.dataTransfer.files) }}
            style={{
              border: `2px dashed ${dragOver ? '#185FA5' : '#d1d5db'}`,
              borderRadius: 12, padding: '2rem', textAlign: 'center',
              cursor: 'pointer', background: dragOver ? '#F0F7FF' : '#f9fafb',
              transition: 'all .15s', marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              {totalFila === 0 ? 'Clique ou arraste os PDFs aqui' : `Adicionar mais (${totalFila}/${LIMITE_ARQUIVOS})`}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              Até {LIMITE_ARQUIVOS} arquivos · máx. 50 MB cada · PDF apenas · {CONCORRENCIA} em paralelo
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.length) adicionarArquivos(e.target.files); e.target.value = '' }} />

        {erroGlobal && (
          <div style={{ background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F7C1C1', borderRadius: 8, padding: '9px 14px', fontSize: 12, marginBottom: 12 }}>
            {erroGlobal}
          </div>
        )}

        {/* Fila */}
        {fila.length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
            {fila.map((item, idx) => (
              <div key={item.id}>
                {/* Linha principal */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderBottom: item.expandido || idx < fila.length - 1 ? '0.5px solid #f3f4f6' : 'none',
                  background: item.estado === 'processando' ? '#F8FBFF'
                    : item.estado === 'confirmar_func' ? '#FFFBF0' : '#fff',
                }}>
                  {/* Ícone */}
                  <div style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>
                    {item.estado === 'aguardando'     && <span style={{ color: '#d1d5db' }}>⏳</span>}
                    {item.estado === 'processando'    && <Spinner />}
                    {item.estado === 'salvo'          && <span style={{ color: '#27a048' }}>✓</span>}
                    {item.estado === 'erro'           && <span style={{ color: '#dc2626' }}>✗</span>}
                    {item.estado === 'confirmar_func' && <span style={{ color: '#EF9F27' }}>!</span>}
                  </div>

                  {/* Nome e subtítulo */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.nome}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 1 }}>
                      {item.estado === 'processando'    && <span style={{ color: '#9ca3af' }}>{item.progresso || 'Processando...'}</span>}
                      {item.estado === 'aguardando'     && <span style={{ color: '#9ca3af' }}>{fmtTamanho(item.tamanho)}</span>}
                      {item.estado === 'salvo'          && <span style={{ color: '#6b7280' }}>{item.resumo}</span>}
                      {item.estado === 'erro'           && <span style={{ color: '#dc2626' }}>{item.erro}</span>}
                      {item.estado === 'confirmar_func' && <span style={{ color: '#92600A', fontWeight: 500 }}>Funcionário não encontrado — confirme os dados abaixo</span>}
                    </div>
                  </div>

                  {/* Badge tipo */}
                  {item.info && (
                    <div style={{ flexShrink: 0, padding: '2px 10px', background: item.info.bg, borderRadius: 99, fontSize: 11, fontWeight: 600, color: item.info.cor }}>
                      {item.info.icone} {item.info.label}
                    </div>
                  )}

                  {/* Toggle expandir (confirmar_func) */}
                  {item.estado === 'confirmar_func' && (
                    <button onClick={() => atualizarItem(item.id, { expandido: !item.expandido })} style={{
                      flexShrink: 0, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                      background: '#FAEEDA', border: '0.5px solid #F0C87A', borderRadius: 6,
                      cursor: 'pointer', color: '#633806',
                    }}>
                      {item.expandido ? 'Fechar ▲' : 'Confirmar ▼'}
                    </button>
                  )}

                  {/* Remover */}
                  {!processando && item.estado !== 'processando' && item.estado !== 'confirmar_func' && (
                    <button onClick={() => removerItem(item.id)} style={{ flexShrink: 0, background: 'none', border: 'none', fontSize: 16, color: '#d1d5db', cursor: 'pointer', padding: '0 2px' }}>×</button>
                  )}
                </div>

                {/* Painel de confirmação de funcionário */}
                {item.estado === 'confirmar_func' && item.expandido && (
                  <ConfirmarFuncionario
                    form={item.formFunc}
                    salvando={item.salvandoConfirmacao}
                    erroForm={item.erroForm}
                    onChange={patch => atualizarItem(item.id, { formFunc: { ...item.formFunc, ...patch } })}
                    onConfirmar={() => confirmarESalvar(item.id)}
                    onPular={() => pularItem(item.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Ações */}
        {fila.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

            {totalAguardando > 0 && !processando && (
              <button onClick={processarFila} style={{ padding: '9px 20px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Processar {totalAguardando} arquivo{totalAguardando > 1 ? 's' : ''}
              </button>
            )}

            {processando && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#E6F1FB', borderRadius: 8 }}>
                <Spinner />
                <span style={{ fontSize: 13, color: '#185FA5', fontWeight: 500 }}>Processando...</span>
              </div>
            )}

            {totalSalvos > 0 && !processando && totalConfirmacao === 0 && (
              <button onClick={navegar} style={{ padding: '9px 18px', background: '#27500A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Ver documentos salvos →
              </button>
            )}

            {!processando && (
              <button onClick={() => { setFila([]); setErroGlobal('') }} style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Limpar lista
              </button>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: 12, alignItems: 'center' }}>
              {totalSalvos      > 0 && <span style={{ color: '#27a048', fontWeight: 600 }}>✓ {totalSalvos} salvo{totalSalvos > 1 ? 's' : ''}</span>}
              {totalConfirmacao > 0 && <span style={{ color: '#EF9F27', fontWeight: 600 }}>! {totalConfirmacao} pendente{totalConfirmacao > 1 ? 's' : ''}</span>}
              {totalErros       > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ {totalErros} erro{totalErros > 1 ? 's' : ''}</span>}
              {totalAguardando  > 0 && !processando && <span style={{ color: '#9ca3af' }}>{totalAguardando} aguardando</span>}
            </div>
          </div>
        )}

        {fila.length === 0 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
            {Object.entries(TIPO_INFO).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: v.bg, borderRadius: 99 }}>
                <span style={{ fontSize: 13 }}>{v.icone}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: v.cor }}>{v.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

// ── Painel de confirmação de funcionário ──────────────────
function ConfirmarFuncionario({ form, salvando, erroForm, onChange, onConfirmar, onPular }) {
  return (
    <div style={{ background: '#FFFBF0', borderTop: '0.5px solid #F0C87A', padding: '16px 20px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#92600A', marginBottom: 12 }}>
        Funcionário não encontrado no cadastro — confirme os dados extraídos pelo sistema:
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Campo label="Nome completo *">
          <input style={inp} value={form.nome} onChange={e => onChange({ nome: e.target.value })} />
        </Campo>
        <Campo label="CPF *">
          <input style={inp} value={form.cpf} onChange={e => onChange({ cpf: fmtCPF(e.target.value) })} />
        </Campo>
        <Campo label="Data de nascimento">
          <input style={inp} type="date" value={form.data_nasc} onChange={e => onChange({ data_nasc: e.target.value })} />
        </Campo>
        <Campo label="Data de admissão">
          <input style={inp} type="date" value={form.data_adm} onChange={e => onChange({ data_adm: e.target.value })} />
        </Campo>
        <Campo label="Função / Cargo">
          <input style={inp} value={form.funcao} onChange={e => onChange({ funcao: e.target.value })} />
        </Campo>
        <Campo label="Setor / GHE">
          <input style={inp} value={form.setor} onChange={e => onChange({ setor: e.target.value })} />
        </Campo>
      </div>

      {erroForm && (
        <div style={{ background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F7C1C1', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>
          {erroForm}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onConfirmar} disabled={salvando} style={{
          padding: '7px 16px', background: '#633806', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: salvando ? 'not-allowed' : 'pointer',
          opacity: salvando ? 0.7 : 1,
        }}>
          {salvando ? 'Cadastrando...' : '✓ Cadastrar funcionário e salvar ASO'}
        </button>
        <button onClick={onPular} disabled={salvando} style={{
          padding: '7px 12px', background: 'transparent', border: '1px solid #d1d5db',
          borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#6b7280',
        }}>
          Pular este arquivo
        </button>
      </div>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  )
}

const inp = {
  width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db',
  borderRadius: 7, background: '#fff', color: '#111', boxSizing: 'border-box',
  fontFamily: 'inherit', outline: 'none',
}

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #d1d5db', borderTopColor: '#185FA5', borderRadius: '50%', animation: 'spin .7s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </span>
  )
}

function uid() { return Math.random().toString(36).slice(2) }
