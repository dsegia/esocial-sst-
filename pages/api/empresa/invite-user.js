// pages/api/empresa/invite-user.js
// Convida um novo usuário para a empresa do solicitante

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey) return res.status(500).json({ erro: 'SUPABASE_SERVICE_ROLE_KEY não configurada' })

  // Valida sessão do solicitante
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ erro: 'Não autenticado' })

  const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ erro: 'Sessão inválida' })

  // Busca empresa_id do solicitante
  const { data: solicitante } = await supabaseAnon.from('usuarios')
    .select('empresa_id').eq('id', user.id).single()
  if (!solicitante?.empresa_id) return res.status(403).json({ erro: 'Usuário sem empresa associada' })

  const empresaId = solicitante.empresa_id
  const { email, nome, perfil = 'operador' } = req.body
  const PERFIS_VALIDOS = ['admin', 'operador', 'visualizador']
  if (!PERFIS_VALIDOS.includes(perfil)) return res.status(400).json({ erro: 'Perfil inválido' })

  if (!email || !email.includes('@')) return res.status(400).json({ erro: 'E-mail inválido' })

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Verifica se o e-mail já é usuário desta empresa
  const { data: jaExiste } = await sb.from('usuarios')
    .select('id').eq('email', email).eq('empresa_id', empresaId).single()
  if (jaExiste) return res.status(409).json({ erro: 'Este e-mail já é usuário desta empresa' })

  // Verifica se já existe na auth (outro usuário de outra empresa)
  const { data: authUsers } = await sb.auth.admin.listUsers()
  const jaAuth = authUsers?.users?.find(u => u.email === email)
  if (jaAuth) {
    // Já tem conta — adiciona direto na empresa sem reenviar convite
    const { error: insErr } = await sb.from('usuarios').upsert({
      id: jaAuth.id,
      email: email,
      nome: nome || jaAuth.user_metadata?.nome || email.split('@')[0],
      empresa_id: empresaId,
      perfil,
    }, { onConflict: 'id' })
    if (insErr) return res.status(500).json({ erro: 'Erro ao vincular usuário: ' + insErr.message })
    return res.status(200).json({ sucesso: true, tipo: 'vinculado', mensagem: 'Usuário vinculado à empresa com sucesso' })
  }

  // Novo usuário — envia convite
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esocial-sst.vercel.app'
  const redirectTo = `${siteUrl}/aceitar-convite?empresa_id=${empresaId}`

  const { data: invited, error: invErr } = await sb.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { nome: nome || '', empresa_id: empresaId, perfil },
  })
  if (invErr) return res.status(500).json({ erro: 'Erro ao enviar convite: ' + invErr.message })

  // Cria registro provisional em usuarios para exibir na lista
  await sb.from('usuarios').upsert({
    id: invited.user.id,
    email,
    nome: nome || '',
    empresa_id: empresaId,
    perfil,
  }, { onConflict: 'id' })

  return res.status(200).json({ sucesso: true, tipo: 'convidado', mensagem: `Convite enviado para ${email}` })
}
