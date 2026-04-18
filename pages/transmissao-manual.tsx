// pages/transmissao-manual.tsx
// Tela para transmitir eventos ao Gov.br com certificado digital A1

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ETAPAS = ['certificado', 'selecionar', 'assinar', 'transmitir', 'resultado']

export default function TransmissaoManual() {
  const router = useRouter()
  const certRef = useRef()
  const [empresa, setEmpresa] = useState(null)
  const [empresaId, setEmpresaId] = useState('')
  const [etapa, setEtapa] = useState('certificado')
  const [pendentes, setPendentes] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [resultados, setResultados] = useState([])
  const [ambiente, setAmbiente] = useState('producao_restrita')
  const [testando, setTestando] = useState(false)
  const [testeResult, setTesteResult] = useState<null | { ok: boolean; msg: string; latencia?: number }>(null)

  // Certificado (nunca sai do estado do browser)
  const [certArquivo, setCertArquivo] = useState(null)
  const [certSenha, setCertSenha] = useState('')
  const [certInfo, setCertInfo] = useState(null)
  const [pfxBase64, setPfxBase64] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios')
      .select('empresa_id, empresas(razao_social, cnpj, cert_digital_validade, cert_titular, plano)')
      .eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresa(user.empresas)
    setEmpresaId(user.empresa_id)

    const { data: txs } = await supabase.from('transmissoes')
      .select('id, evento, status, criado_em, funcionarios(nome, matricula_esocial)')
      .eq('empresa_id', user.empresa_id)
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false })
    setPendentes(txs || [])
    setCarregando(false)
  }

  async function testarConexao() {
    setTestando(true)
    setTesteResult(null)
    try {
      const resp = await fetch(`/api/testar-conexao-esocial?ambiente=${ambiente}`)
      const data = await resp.json()
      if (data.conectado) {
        setTesteResult({ ok: true, msg: `Conexão OK — Gov.br respondeu em ${data.latencia_ms}ms. ${data.descricao || ''}`, latencia: data.latencia_ms })
      } else {
        setTesteResult({ ok: false, msg: `Sem conexão: ${data.erro}` })
      }
    } catch {
      setTesteResult({ ok: false, msg: 'Erro ao testar conexão com o servidor.' })
    }
    setTestando(false)
  }

  async function lerCertificado() {
    if (!certArquivo || !certSenha) { setErro('Selecione o arquivo e informe a senha.'); return }
    setProcessando(true); setErro('')
    try {
      const base64 = await new Promise(resolve => {
        const r = new FileReader()
        r.onload = e => resolve(e.target.result.split(',')[1])
        r.readAsDataURL(certArquivo)
      })
      setPfxBase64(base64)

      const resp = await fetch('/api/ler-certificado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pfx: base64, senha: certSenha })
      })
      const data = await resp.json()
      if (!data.sucesso) throw new Error(data.erro)
      setCertInfo(data.info)
      setSucesso('Certificado lido com sucesso! Prossiga para selecionar os eventos.')
      setEtapa('selecionar')
    } catch (err) {
      setErro(err.message)
    }
    setProcessando(false)
  }

  async function transmitirSelecionados() {
    if (!selecionados.length) { setErro('Selecione ao menos uma transmissão.'); return }
    if (!pfxBase64 || !certSenha) { setErro('Certificado não carregado.'); return }

    // Período de teste: limitar 1 transmissão enviada por tipo de evento
    if (empresa?.plano === 'trial') {
      const { data: jaEnviados } = await supabase.from('transmissoes')
        .select('evento')
        .eq('empresa_id', empresaId)
        .eq('status', 'enviado')

      const countEnviados: Record<string, number> = {}
      for (const tx of (jaEnviados || [])) {
        countEnviados[tx.evento] = (countEnviados[tx.evento] || 0) + 1
      }

      // Contar quantos de cada evento estão sendo selecionados agora
      const countSelecionando: Record<string, number> = {}
      for (const id of selecionados) {
        const ev = pendentes.find(t => t.id === id)?.evento
        if (ev) countSelecionando[ev] = (countSelecionando[ev] || 0) + 1
      }

      const bloqueados: string[] = []
      for (const [evt, qtd] of Object.entries(countSelecionando)) {
        if ((countEnviados[evt] || 0) >= 1) bloqueados.push(`${evt} (já enviado)`)
        else if (qtd > 1) bloqueados.push(`${evt} (selecione apenas 1 por vez no trial)`)
      }

      if (bloqueados.length > 0) {
        setErro(`Período de teste: limite de 1 transmissão por tipo de evento. Bloqueado: ${bloqueados.join(' | ')}`)
        return
      }
    }

    setProcessando(true); setErro(''); setSucesso('')
    setEtapa('assinar')

    const resultadosTx = []

    for (const txId of selecionados) {
      const tx = pendentes.find(t => t.id === txId)
      try {
        // 1. Buscar dados completos da transmissão
        const { data: txCompleta } = await supabase.from('transmissoes')
          .select(`*, funcionarios(nome, cpf, matricula_esocial), asos(*), ltcats(*), cats(*)`)
          .eq('id', txId).single()

        // Mapear dados conforme referencia_tipo
        let dadosEvento = null
        if (txCompleta.referencia_tipo === 'aso') dadosEvento = txCompleta.asos
        else if (txCompleta.referencia_tipo === 'ltcat') dadosEvento = txCompleta.ltcats
        else if (txCompleta.referencia_tipo === 'cat') dadosEvento = txCompleta.cats

        // 2. Gerar XML
        const xmlResp = await fetch('/api/xml-generator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: txCompleta.evento,
            dados: dadosEvento,
            empresa: { cnpj: empresa.cnpj },
            ambiente,
          })
        })
        const xmlData = await xmlResp.json()
        if (!xmlData.sucesso) throw new Error('Erro ao gerar XML: ' + xmlData.erro)

        setEtapa('assinar')

        // 3. Assinar XML
        const TAG_MAP = { 'S-2220':'evtMonit', 'S-2240':'evtExpRisco', 'S-2210':'evtCAT' }
        const assinarResp = await fetch('/api/assinar-xml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            xml: xmlData.xml,
            pfx: pfxBase64,
            senha: certSenha,
            tagAssinatura: TAG_MAP[txCompleta.evento] || 'eSocial'
          })
        })
        const assinarData = await assinarResp.json()
        if (!assinarData.sucesso) throw new Error('Erro na assinatura: ' + assinarData.erro)

        setEtapa('transmitir')

        // 4. Transmitir ao Gov.br
        const transmitirResp = await fetch('/api/transmitir-esocial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            xml_assinado: assinarData.xml_assinado,
            cnpj_empregador: empresa.cnpj,
            ambiente,
            transmissao_id: txId,
          })
        })
        const transmitirData = await transmitirResp.json()

        if (transmitirData.sucesso) {
          // Atualizar status no banco
          await supabase.from('transmissoes').update({
            status: 'enviado',
            recibo: transmitirData.recibo,
            dt_envio: transmitirData.data_envio,
            tentativas: (txCompleta.tentativas || 0) + 1,
          }).eq('id', txId)

          resultadosTx.push({
            id: txId,
            evento: txCompleta.evento,
            funcionario: tx.funcionarios?.nome,
            sucesso: true,
            recibo: transmitirData.recibo,
            descricao: transmitirData.descricao,
          })
        } else {
          // Marcar como rejeitado
          await supabase.from('transmissoes').update({
            status: 'rejeitado',
            tentativas: (txCompleta.tentativas || 0) + 1,
            erro_descricao: transmitirData.descricao || transmitirData.erro,
          }).eq('id', txId)

          resultadosTx.push({
            id: txId,
            evento: txCompleta.evento,
            funcionario: tx.funcionarios?.nome,
            sucesso: false,
            codigo: transmitirData.codigo,
            descricao: transmitirData.descricao || transmitirData.erro,
            ocorrencias: transmitirData.ocorrencias || [],
          })
        }
      } catch (err) {
        resultadosTx.push({
          id: txId,
          evento: tx?.evento,
          funcionario: tx?.funcionarios?.nome,
          sucesso: false,
          descricao: err.message,
        })
      }
    }

    setResultados(resultadosTx)
    setEtapa('resultado')
    setProcessando(false)
    init() // recarregar pendentes
  }

  const enviados = resultados.filter(r => r.sucesso).length
  const rejeitados = resultados.filter(r => !r.sucesso).length

  if (carregando) return <div style={s.loading}>Carregando...</div>

  return (
    <Layout pagina="historico">
      <Head><title>Transmissão — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>Transmissão ao Gov.br</div>
          <div style={s.sub}>Assinar e transmitir eventos eSocial SST</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select style={{ ...s.input, width:'auto' }} value={ambiente} onChange={e => { setAmbiente(e.target.value); setTesteResult(null) }}>
            <option value="producao_restrita">Produção Restrita (Testes)</option>
            <option value="producao">Produção (Real)</option>
          </select>
          <button onClick={testarConexao} disabled={testando}
            style={{ background:'#f0f4f8', border:'1px solid #cbd5e1', borderRadius:8, padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#374151', whiteSpace:'nowrap' }}>
            {testando ? 'Testando...' : '🔌 Testar conexão'}
          </button>
        </div>
      </div>
      {testeResult && (
        <div style={{ background: testeResult.ok ? '#EAF3DE' : '#FCEBEB', border: `1px solid ${testeResult.ok ? '#C0DD97' : '#E24B4A'}`, borderRadius:10, padding:'10px 16px', fontSize:12, color: testeResult.ok ? '#2D6A00' : '#791F1F', marginBottom:14, fontWeight:500 }}>
          {testeResult.ok ? '✅' : '❌'} {testeResult.msg}
        </div>
      )}

      {/* Aviso produção */}
      {ambiente === 'producao' && (
        <div style={{ background:'#FCEBEB', border:'1.5px solid #E24B4A', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#791F1F', marginBottom:14, fontWeight:500 }}>
          ⚠ ATENÇÃO: Modo PRODUÇÃO selecionado. Os eventos serão transmitidos de verdade ao Gov.br.
        </div>
      )}
      {ambiente === 'producao_restrita' && (
        <div style={{ background:'#E6F1FB', border:'0.5px solid #B5D4F4', borderRadius:10, padding:'10px 16px', fontSize:12, color:'#0C447C', marginBottom:14 }}>
          Modo Produção Restrita: ambiente de testes do Gov.br. Nenhum dado real é enviado.
        </div>
      )}

      {erro && <div style={s.erroBox}>{erro}</div>}
      {sucesso && <div style={s.sucessoBox}>{sucesso}</div>}

      {/* ETAPA 1: Certificado */}
      {etapa === 'certificado' && (
        <div style={s.card}>
          <div style={s.cardTit}>🔐 Etapa 1 — Carregar certificado digital A1</div>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:14, lineHeight:1.7 }}>
            O certificado é usado apenas para assinar os XMLs nesta sessão. Não é armazenado.
          </div>

          {empresa?.cert_digital_validade && (
            <div style={{ background:'#EAF3DE', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:12, marginBottom:14 }}>
              Certificado configurado: <strong>{empresa.cert_titular}</strong> · Válido até {new Date(empresa.cert_digital_validade).toLocaleDateString('pt-BR')}
            </div>
          )}

          <div style={s.row2}>
            <div>
              <label style={s.label}>Arquivo do certificado (.pfx)</label>
              <div style={{ border:'2px dashed #d1d5db', borderRadius:8, padding:14, textAlign:'center', cursor:'pointer' }}
                onClick={() => certRef.current.click()}>
                {certArquivo
                  ? <div style={{ color:'#185FA5', fontSize:13, fontWeight:500 }}>✓ {certArquivo.name}</div>
                  : <div style={{ color:'#9ca3af', fontSize:13 }}>Clique para selecionar</div>}
              </div>
              <input ref={certRef} type="file" accept=".pfx,.p12" style={{ display:'none' }}
                onChange={e => setCertArquivo(e.target.files[0])} />
            </div>
            <div>
              <label style={s.label}>Senha do certificado</label>
              <input style={s.input} type="password" placeholder="Senha do arquivo .pfx"
                value={certSenha} onChange={e => setCertSenha(e.target.value)}
                onKeyDown={e => e.key==='Enter' && lerCertificado()} />
            </div>
          </div>
          <button style={s.btnPrimary} onClick={lerCertificado} disabled={processando || !certArquivo || !certSenha}>
            {processando ? 'Lendo certificado...' : 'Validar certificado →'}
          </button>
        </div>
      )}

      {/* ETAPA 2: Selecionar eventos */}
      {(etapa === 'selecionar' || etapa === 'certificado') && certInfo && (
        <div style={s.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={s.cardTit}>📋 Etapa 2 — Selecionar eventos para transmitir</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>{pendentes.length} pendente(s)</div>
          </div>

          {pendentes.length === 0 ? (
            <div style={{ fontSize:13, color:'#9ca3af', textAlign:'center', padding:'2rem' }}>
              Nenhuma transmissão pendente.
            </div>
          ) : (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                <button style={s.btnOutline} onClick={() => setSelecionados(pendentes.map(t=>t.id))}>
                  Selecionar todos ({pendentes.length})
                </button>
                <button style={s.btnOutline} onClick={() => setSelecionados([])}>
                  Limpar seleção
                </button>
              </div>
              {pendentes.map(tx => {
                const sel = selecionados.includes(tx.id)
                const EVT_BG = { 'S-2210':'#FCEBEB', 'S-2220':'#E6F1FB', 'S-2240':'#FAEEDA' }
                const EVT_COR = { 'S-2210':'#791F1F', 'S-2220':'#0C447C', 'S-2240':'#633806' }
                return (
                  <div key={tx.id} onClick={() => setSelecionados(p => p.includes(tx.id) ? p.filter(x=>x!==tx.id) : [...p,tx.id])}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:8,
                      border: sel?'1.5px solid #185FA5':'0.5px solid #e5e7eb',
                      background: sel?'#EFF6FF':'#fff', cursor:'pointer', marginBottom:6 }}>
                    <input type="checkbox" checked={sel} readOnly style={{ width:16, height:16 }}/>
                    <span style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700,
                      background: EVT_BG[tx.evento]||'#f3f4f6', color: EVT_COR[tx.evento]||'#374151' }}>
                      {tx.evento}
                    </span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{tx.funcionarios?.nome || '—'}</div>
                      <div style={{ fontSize:11, color:'#6b7280' }}>
                        {new Date(tx.criado_em).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                )
              })}

              {selecionados.length > 0 && (
                <div style={{ marginTop:12 }}>
                  <button style={{ ...s.btnPrimary, fontSize:14 }}
                    onClick={transmitirSelecionados} disabled={processando}>
                    {processando
                      ? etapa === 'assinar' ? '✍ Assinando XMLs...' : '📡 Transmitindo ao Gov.br...'
                      : `Assinar e transmitir ${selecionados.length} evento(s) →`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ETAPA: Resultado */}
      {etapa === 'resultado' && resultados.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTit}>📊 Resultado da transmissão</div>
          <div style={{ display:'flex', gap:12, marginBottom:16, marginTop:8 }}>
            <div style={{ flex:1, background:'#EAF3DE', borderRadius:10, padding:'12px', textAlign:'center' }}>
              <div style={{ fontSize:24, fontWeight:700, color:'#1D9E75' }}>{enviados}</div>
              <div style={{ fontSize:12, color:'#27500A' }}>Enviados com sucesso</div>
            </div>
            <div style={{ flex:1, background: rejeitados>0?'#FCEBEB':'#f9fafb', borderRadius:10, padding:'12px', textAlign:'center' }}>
              <div style={{ fontSize:24, fontWeight:700, color: rejeitados>0?'#E24B4A':'#9ca3af' }}>{rejeitados}</div>
              <div style={{ fontSize:12, color: rejeitados>0?'#791F1F':'#9ca3af' }}>Rejeitados</div>
            </div>
          </div>

          {resultados.map((r,i) => (
            <div key={i} style={{ borderRadius:8, border:`0.5px solid ${r.sucesso?'#C0DD97':'#F7C1C1'}`,
              background: r.sucesso?'#EAF3DE':'#FCEBEB', padding:'10px 14px', marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <span style={{ fontWeight:600, fontSize:13, color: r.sucesso?'#27500A':'#791F1F' }}>
                    {r.sucesso ? '✅' : '❌'} {r.evento} — {r.funcionario || '—'}
                  </span>
                </div>
                {r.recibo && <span style={{ fontSize:11, fontFamily:'monospace', color:'#27500A' }}>Recibo: {r.recibo}</span>}
              </div>
              {r.descricao && <div style={{ fontSize:12, marginTop:4, color: r.sucesso?'#085041':'#791F1F' }}>{r.descricao}</div>}
              {r.ocorrencias?.map((oc,j) => (
                <div key={j} style={{ fontSize:11, color:'#791F1F', marginTop:2 }}>• {oc}</div>
              ))}
            </div>
          ))}

          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button style={s.btnPrimary} onClick={() => { setEtapa('selecionar'); setResultados([]); setSelecionados([]) }}>
              Transmitir mais eventos
            </button>
            <button style={s.btnOutline} onClick={() => router.push('/historico')}>
              Ver histórico completo →
            </button>
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
  card:       { background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' },
  cardTit:    { fontSize:13, fontWeight:600, color:'#111', marginBottom:12 },
  row2:       { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 },
  label:      { display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 },
  input:      { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' },
  btnPrimary: { padding:'10px 20px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnOutline: { padding:'8px 16px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', color:'#374151' },
  erroBox:    { background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
  sucessoBox: { background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 },
}
