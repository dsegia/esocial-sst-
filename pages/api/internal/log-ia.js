// pages/api/internal/log-ia.js
// Endpoint interno para logging não-bloqueante de chamadas às IAs
// Chamado fire-and-forget por ler-documento.js

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Sempre retorna 200 para não quebrar o caller
  if (req.method !== 'POST') return res.status(200).end()

  const secret = req.headers['x-internal-secret']
  if (secret !== 'esocial-internal') return res.status(200).end()

  try {
    const { servico, modelo, status, duracao_ms, tipo, erro } = req.body
    if (!servico || !status) return res.status(200).end()

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    await sb.from('api_logs').insert({
      servico,
      modelo: modelo || null,
      status,
      duracao_ms: duracao_ms ? Math.round(duracao_ms) : null,
      tipo: tipo || null,
      erro: erro ? String(erro).substring(0, 200) : null,
    })
  } catch {
    // silently ignore — logging must never break the main flow
  }

  return res.status(200).end()
}
