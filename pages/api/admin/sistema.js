// pages/api/admin/sistema.js
// Painel de saúde: status das APIs externas, logs de IA, transmissões com problema
// GET  → retorna dados de saúde
// POST { acao: 'marcar_erro', transmissao_id } → marca transmissão presa como erro

import { createClient } from '@supabase/supabase-js'

const GOVBR_ENDPOINT = 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/envioLoteEventos/enviarLoteEventos/v1_1_0/index.php'

async function autenticarAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null

  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data: { user }, error } = await supabaseAnon.auth.getUser(token)
  if (error || !user || user.email !== process.env.ADMIN_EMAIL) return null
  return user
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ erro: 'Método não permitido' })
  }

  const user = await autenticarAdmin(req)
  if (!user) return res.status(403).json({ erro: 'Acesso restrito' })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // ─── POST: ações administrativas ──────────────────────────────────
  if (req.method === 'POST') {
    const { acao, transmissao_id } = req.body

    if (acao === 'marcar_erro' && transmissao_id) {
      const { error } = await sb.from('transmissoes').update({
        status: 'rejeitado',
        erro_descricao: 'Marcado pelo admin: transmissão presa por mais de 2h',
      }).eq('id', transmissao_id).eq('status', 'pendente')
      if (error) return res.status(500).json({ erro: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ erro: 'Ação inválida' })
  }

  // ─── GET: dados de saúde ───────────────────────────────────────────
  const agora = new Date()
  const ha24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const ha7d  = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const ha2h  = new Date(agora.getTime() - 2 * 60 * 60 * 1000).toISOString()

  const [govbrResult, apiLogsResult, transmErrosResult, transmStatsResult, empresasResult] = await Promise.allSettled([
    // 1. Ping Gov.br
    (async () => {
      const t0 = Date.now()
      try {
        const r = await fetch(GOVBR_ENDPOINT, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10000),
        })
        return { acessivel: r.status < 500 || r.status === 405, latencia_ms: Date.now() - t0, status_http: r.status }
      } catch (e) {
        return { acessivel: false, latencia_ms: Date.now() - t0, erro: e.message?.substring(0, 80) }
      }
    })(),

    // 2. api_logs: últimas 24h
    sb.from('api_logs')
      .select('servico, modelo, status, duracao_ms, tipo, erro, criado_em')
      .gte('criado_em', ha24h)
      .order('criado_em', { ascending: false })
      .limit(200),

    // 3. Transmissões com problema (presa pendente > 2h ou rejeitadas)
    sb.from('transmissoes')
      .select('id, empresa_id, evento, status, erro_codigo, erro_descricao, tentativas, criado_em')
      .or(`and(status.eq.pendente,criado_em.lt.${ha2h}),status.eq.rejeitado`)
      .order('criado_em', { ascending: false })
      .limit(40),

    // 4. Stats de transmissão últimos 7 dias
    sb.from('transmissoes')
      .select('status, criado_em')
      .gte('criado_em', ha7d),

    // 5. Mapa empresa_id → nome (para enriquecer erros)
    sb.from('empresas').select('id, razao_social'),
  ])

  // ── Gov.br ──────────────────────────────────────────────────────────
  const govbr = govbrResult.status === 'fulfilled'
    ? govbrResult.value
    : { acessivel: false, erro: 'Timeout' }

  // ── api_logs ─────────────────────────────────────────────────────────
  const apiLogsOk = apiLogsResult.status === 'fulfilled' && !apiLogsResult.value.error
  const apiLogsData = apiLogsOk ? (apiLogsResult.value.data || []) : []

  const logsPorServico = {}
  for (const log of apiLogsData) {
    if (!logsPorServico[log.servico]) {
      logsPorServico[log.servico] = { total: 0, ok: 0, erro: 0, fallback: 0, duracao_total: 0 }
    }
    const s = logsPorServico[log.servico]
    s.total++
    if (log.status === 'ok')       { s.ok++; s.duracao_total += log.duracao_ms || 0 }
    else if (log.status === 'erro' || log.status === 'timeout') s.erro++
    else if (log.status === 'fallback') s.fallback++
  }
  for (const svc of Object.values(logsPorServico)) {
    svc.media_ms = svc.ok > 0 ? Math.round(svc.duracao_total / svc.ok) : null
    svc.taxa_sucesso = svc.total > 0 ? Math.round((svc.ok / svc.total) * 100) : null
    delete svc.duracao_total
  }

  // ── Transmissões com problema ────────────────────────────────────────
  const empresaMap = {}
  if (empresasResult.status === 'fulfilled') {
    for (const e of (empresasResult.value.data || [])) empresaMap[e.id] = e.razao_social
  }

  const transmErros = (transmErrosResult.status === 'fulfilled' ? transmErrosResult.value.data || [] : [])
    .map(t => ({ ...t, empresa_nome: empresaMap[t.empresa_id] || t.empresa_id }))

  const pendentesPresos = transmErros.filter(t => t.status === 'pendente')
  const rejeitados      = transmErros.filter(t => t.status === 'rejeitado')

  // ── Stats 7d ─────────────────────────────────────────────────────────
  const statsRaw = transmStatsResult.status === 'fulfilled' ? transmStatsResult.value.data || [] : []
  const stats7d = {
    total:     statsRaw.length,
    pendente:  statsRaw.filter(t => t.status === 'pendente').length,
    enviado:   statsRaw.filter(t => t.status === 'enviado' || t.status === 'lote').length,
    rejeitado: statsRaw.filter(t => t.status === 'rejeitado').length,
  }

  return res.status(200).json({
    servicos: {
      anthropic: {
        key_configurada: !!process.env.ANTHROPIC_API_KEY,
        logs_24h: logsPorServico['claude'] || null,
      },
      gemini: {
        key_configurada: !!process.env.GEMINI_API_KEY,
        logs_24h: logsPorServico['gemini'] || null,
      },
      govbr,
      supabase: { ativo: true },
    },
    transmissoes: {
      stats_7d: stats7d,
      pendentes_presos: pendentesPresos,
      rejeitados: rejeitados,
    },
    api_logs: {
      disponivel: apiLogsOk,
      ultimas: apiLogsData.slice(0, 30),
    },
    gerado_em: agora.toISOString(),
  })
}
