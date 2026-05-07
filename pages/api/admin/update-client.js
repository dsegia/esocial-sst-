// pages/api/admin/update-client.js
// Atualiza plano ou status de uma empresa (ativar, bloquear, mudar plano)

import { createClient } from '@supabase/supabase-js'

const PLANOS_VALIDOS = ['trial', 'starter', 'professional', 'business', 'cancelado']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const adminEmail = process.env.ADMIN_EMAIL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!adminEmail || !serviceKey) {
    return res.status(500).json({ erro: 'Variáveis de ambiente não configuradas' })
  }

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ erro: 'Não autenticado' })

  const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ erro: 'Sessão inválida' })
  if (user.email !== adminEmail) return res.status(403).json({ erro: 'Acesso restrito' })

  const { empresa_id, plano, bloqueado, observacao: _observacao } = req.body

  if (!empresa_id) return res.status(400).json({ erro: 'empresa_id obrigatório' })
  if (plano && !PLANOS_VALIDOS.includes(plano)) {
    return res.status(400).json({ erro: 'Plano inválido' })
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    const patch = {}
    if (plano !== undefined) patch.plano = plano
    if (bloqueado !== undefined) patch.ativo = !bloqueado  // coluna real é "ativo"
    if (plano === 'trial') patch.trial_inicio = new Date().toISOString()

    const { error } = await sb.from('empresas').update(patch).eq('id', empresa_id)
    if (error) throw new Error(error.message)

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[admin/update-client]', err)
    return res.status(500).json({ erro: 'Erro interno do servidor.' })
  }
}
