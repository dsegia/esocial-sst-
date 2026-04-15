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
  ltcat: { label: 'LTCAT', cor: '#185FA5', bg: '#E6F1FB', icone: '🏭', desc: 'Laudo Técnico das Condições Ambientais do Trabalho' },
  pcmso: { label: 'PCMSO', cor: '#27500A', bg: '#EAF3DE', icone: '🩺', desc: 'Programa de Controle Médico de Saúde Ocupacional' },
  aso:   { label: 'ASO',   cor: '#633806', bg: '#FAEEDA', icone: '📋', desc: 'Atestado de Saúde Ocupacional' },
}

export default function Importar() {
  const router = useRouter()
  const fileRef = useRef()
  const [empresaId, setEmpresaId] = useState('')
  const [estado, setEstado] = useState('inicio') // inicio | lendo | preview | salvando | pronto
  const [progresso, setProgresso] = useState('')
  const [resultado, setResultado] = useState(null) // { tipo_detectado, dados }
  const [erro, setErro] = useState('')
  const [nomeArquivo, setNomeArquivo] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
        .then(({ data: u }) => {
          if (!u) { router.push('/'); return }
          setEmpresaId(getEmpresaId() || u.empresa_id)
        })
    })
  }, [])

  async function processarArquivo(file) {
    if (!file) return
    setNomeArquivo(file.name)
    setEstado('lendo')
    setErro('')
    setResultado(null)

    try {
      // ── Carrega PDF.js ──────────────────────────────────────
      setProgresso('Analisando PDF...')
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
          s.onload = resolve; s.onerror = reject
          document.head.appendChild(s)
        })
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }
      const lib = window.pdfjsLib
      const arrayBuf = await file.arrayBuffer()
      const pdfDoc = await lib.getDocument({ data: arrayBuf.slice(0) }).promise

      // ── Extrai texto (páginas 1–10) ──────────────────────────
      let textoPdf = ''
      for (let i = 1; i <= Math.min(pdfDoc.numPages, 10); i++) {
        const page = await pdfDoc.getPage(i)
        const content = await page.getTextContent()
        textoPdf += content.items.map(it => it.str).join(' ') + '\n'
      }
      const temTexto = textoPdf.replace(/\s/g, '').length > 300

      // ── Monta payload pelos 3 níveis ─────────────────────────
      // Nível 1: PDF pequeno (≤3 MB) → base64 → Claude nativo (máxima precisão)
      // Nível 2: PDF grande com texto → texto extraído → Claude via prompt
      // Nível 3: PDF grande escaneado → imagens JPEG → Claude visual
      const LIMITE = 3 * 1024 * 1024
      let payload

      if (file.size <= LIMITE) {
        setProgresso('Preparando PDF para leitura nativa...')
        const bytes = new Uint8Array(arrayBuf.slice(0))
        let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
        const pdf_base64 = btoa(bin)
        payload = { pdf_base64, texto_pdf: textoPdf, paginas: [], tipo: 'auto' }

      } else if (temTexto) {
        setProgresso(`PDF grande (${(file.size/1024/1024).toFixed(1)} MB) — usando texto extraído...`)
        payload = { texto_pdf: textoPdf, paginas: [], tipo: 'auto' }

      } else {
        setProgresso('PDF escaneado — convertendo páginas em imagens...')
        const paginas = []
        for (let i = 1; i <= Math.min(pdfDoc.numPages, 5); i++) {
          setProgresso(`Convertendo página ${i} de ${Math.min(pdfDoc.numPages, 5)}...`)
          const page = await pdfDoc.getPage(i)
          const vp = page.getViewport({ scale: 1.5 })
          const canvas = document.createElement('canvas')
          canvas.width = vp.width; canvas.height = vp.height
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
          paginas.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
        }
        payload = { paginas, texto_pdf: '', tipo: 'auto' }
      }

      setProgresso('Identificando tipo do documento com IA...')
      const resp = await fetch('/api/ler-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      let json
      try { json = await resp.json() }
      catch { throw new Error('O servidor não respondeu. Tente novamente em instantes.') }
      if (!resp.ok || !json.sucesso) throw new Error(json.erro || 'Erro na análise do documento')

      setResultado(json)
      setEstado('preview')
    } catch (err) {
      setErro(err.message)
      setEstado('inicio')
    }
  }

  async function confirmarImport() {
    if (!resultado) return
    setEstado('salvando')
    const { tipo_detectado, dados } = resultado

    try {
      if (tipo_detectado === 'ltcat') {
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
        setEstado('pronto')
        setTimeout(() => router.push('/ltcat'), 1800)

      } else if (tipo_detectado === 'pcmso') {
        for (const prog of (dados.programas || [])) {
          await supabase.from('pcmso_programa').upsert({
            empresa_id: empresaId,
            funcao: prog.funcao,
            setor: prog.setor || null,
            riscos: prog.riscos || [],
            exames: (prog.exames || []).map(e => ({
              nome: typeof e === 'string' ? e : e.nome,
              periodicidade: e.periodicidade || 'Anual',
              obrigatorio: true,
            })),
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'empresa_id,funcao' })
        }
        setEstado('pronto')
        setTimeout(() => router.push('/pcmso'), 1800)

      } else if (tipo_detectado === 'aso') {
        // Para ASO: redirecionar para o leitor com dados pré-preenchidos via sessionStorage
        sessionStorage.setItem('aso_importado', JSON.stringify({ dados, empresaId }))
        setEstado('pronto')
        setTimeout(() => router.push('/aso'), 1800)
      }
    } catch (err) {
      setErro('Erro ao salvar: ' + err.message)
      setEstado('preview')
    }
  }

  const info = resultado ? TIPO_INFO[resultado.tipo_detectado] : null

  return (
    <Layout pagina="importar">
      <Head><title>Importar Documento — eSocial SST</title></Head>

      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>Importar Documento</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Envie qualquer documento SST — o sistema identifica automaticamente se é ASO, LTCAT ou PCMSO
          </div>
        </div>

        {/* Área de upload */}
        {(estado === 'inicio' || estado === 'lendo') && (
          <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 14, padding: '2rem' }}>
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) processarArquivo(e.target.files[0]); e.target.value = '' }} />

            {estado === 'inicio' ? (
              <div>
                <div onClick={() => fileRef.current?.click()} style={{
                  border: '2px dashed #d1d5db', borderRadius: 12, padding: '3rem 2rem',
                  textAlign: 'center', cursor: 'pointer', background: '#f9fafb',
                  transition: 'border-color .2s',
                }}>
                  <div style={{ fontSize: 48, marginBottom: 14 }}>📂</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Clique para selecionar o PDF
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    ASO · LTCAT · PCMSO — o sistema detecta automaticamente
                  </div>
                </div>

                {erro && (
                  <div style={{ background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F7C1C1', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginTop: 16 }}>
                    {erro}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'center' }}>
                  {Object.entries(TIPO_INFO).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: v.bg, borderRadius: 99 }}>
                      <span style={{ fontSize: 14 }}>{v.icone}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: v.cor }}>{v.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 8 }}>
                  Analisando documento...
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>{progresso}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{nomeArquivo}</div>
                <div style={{ marginTop: 20, height: 4, background: '#f3f4f6', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: '70%', background: '#185FA5', borderRadius: 99 }}></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview do resultado */}
        {(estado === 'preview' || estado === 'salvando') && resultado && info && (
          <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 14, padding: '2rem' }}>

            {/* Badge tipo detectado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '12px 16px', background: info.bg, borderRadius: 10 }}>
              <span style={{ fontSize: 24 }}>{info.icone}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: info.cor }}>
                  {info.label} detectado
                </div>
                <div style={{ fontSize: 11, color: info.cor, opacity: 0.8 }}>{info.desc}</div>
              </div>
            </div>

            {/* Resumo dos dados extraídos */}
            <div style={{ marginBottom: 20 }}>
              {resultado.tipo_detectado === 'ltcat' && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                    Dados extraídos
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Campo label="Responsável" valor={resultado.dados.dados_gerais?.resp_nome} />
                    <Campo label="Emissão" valor={resultado.dados.dados_gerais?.data_emissao} />
                    <Campo label="Vigência" valor={resultado.dados.dados_gerais?.data_vigencia} />
                    <Campo label="GHEs encontrados" valor={resultado.dados.ghes?.length} />
                  </div>
                  {resultado.dados.ghes?.length > 0 && (
                    <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
                      Grupos: {resultado.dados.ghes.slice(0, 4).map(g => g.nome).join(', ')}
                      {resultado.dados.ghes.length > 4 && ` +${resultado.dados.ghes.length - 4}`}
                    </div>
                  )}
                </div>
              )}

              {resultado.tipo_detectado === 'pcmso' && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                    Dados extraídos
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Campo label="Médico responsável" valor={resultado.dados.dados_gerais?.medico_nome} />
                    <Campo label="CRM" valor={resultado.dados.dados_gerais?.medico_crm} />
                    <Campo label="Elaboração" valor={resultado.dados.dados_gerais?.data_elaboracao} />
                    <Campo label="Programas por função" valor={resultado.dados.programas?.length} />
                  </div>
                  {resultado.dados.programas?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Funções encontradas:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {resultado.dados.programas.slice(0, 6).map((p, i) => (
                          <span key={i} style={{ padding: '2px 10px', background: '#EAF3DE', color: '#27500A', borderRadius: 99, fontSize: 11 }}>
                            {p.funcao}
                          </span>
                        ))}
                        {resultado.dados.programas.length > 6 && (
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>+{resultado.dados.programas.length - 6}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {resultado.tipo_detectado === 'aso' && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                    Dados extraídos
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Campo label="Funcionário" valor={resultado.dados.funcionario?.nome} />
                    <Campo label="CPF" valor={resultado.dados.funcionario?.cpf} />
                    <Campo label="Tipo ASO" valor={resultado.dados.aso?.tipo_aso} />
                    <Campo label="Data exame" valor={resultado.dados.aso?.data_exame} />
                    <Campo label="Conclusão" valor={resultado.dados.aso?.conclusao} />
                    <Campo label="Médico" valor={resultado.dados.aso?.medico_nome} />
                  </div>
                </div>
              )}
            </div>

            {erro && (
              <div style={{ background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F7C1C1', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                {erro}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ padding: '9px 20px', background: info.cor, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                onClick={confirmarImport} disabled={estado === 'salvando'}>
                {estado === 'salvando' ? 'Salvando...' : `✓ Salvar e ir para ${info.label}`}
              </button>
              <button style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#374151' }}
                onClick={() => { setEstado('inicio'); setResultado(null); setErro('') }}>
                Tentar outro arquivo
              </button>
            </div>
          </div>
        )}

        {/* Sucesso */}
        {estado === 'pronto' && info && (
          <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 14, padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 8 }}>
              {info.label} importado com sucesso!
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              Redirecionando para a página do {info.label}...
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

function Campo({ label, valor }) {
  return (
    <div style={{ padding: '8px 10px', background: '#f9fafb', borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111', marginTop: 2, fontWeight: 500 }}>{valor ?? '—'}</div>
    </div>
  )
}
