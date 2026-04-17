import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const PLANOS = {
  starter: {
    nome: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER,
  },
  professional: {
    nome: 'Professional',
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL,
  },
  pro: {
    nome: 'Professional',
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL,
  },
  business: {
    nome: 'Business',
    priceId: process.env.STRIPE_PRICE_BUSINESS,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const siteUrl = 'https://esocial-sst.vercel.app'

    if (!stripeKey) return res.status(500).json({ erro: 'STRIPE_SECRET_KEY não configurada' })

    // Valida sessão
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ erro: 'Não autenticado' })

    const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ erro: 'Sessão inválida' })

    // Busca empresa_id — tenta via tabela usuarios, depois via metadata
    let empresaId = null
    const { data: usuarioDb } = await supabaseAnon.from('usuarios')
      .select('empresa_id').eq('id', user.id).single()
    empresaId = usuarioDb?.empresa_id || user.user_metadata?.empresa_id

    if (!empresaId) {
      console.error('[checkout] empresa_id não encontrado para user:', user.id)
      return res.status(403).json({ erro: 'Empresa não encontrada para este usuário' })
    }

    // Valida plano
    const { plano } = req.body
    const planoInfo = PLANOS[plano]
    if (!planoInfo) {
      console.error('[checkout] plano inválido:', plano)
      return res.status(400).json({ erro: `Plano inválido: "${plano}"` })
    }
    if (!planoInfo.priceId) {
      console.error('[checkout] priceId ausente para plano:', plano)
      return res.status(500).json({ erro: `Price ID não configurado para ${plano}` })
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' })
    const sb = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Busca ou cria customer Stripe
    const { data: empresa } = await sb.from('empresas')
      .select('id, razao_social, cnpj, stripe_customer_id').eq('id', empresaId).single()

    let customerId = empresa?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: empresa?.razao_social || user.email,
        metadata: { empresa_id: empresaId, cnpj: empresa?.cnpj || '' },
      })
      customerId = customer.id
      await sb.from('empresas').update({ stripe_customer_id: customerId }).eq('id', empresaId)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: planoInfo.priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard?upgrade=ok&plano=${plano}`,
      cancel_url: `${siteUrl}/planos?cancelado=1`,
      metadata: { empresa_id: empresaId, plano },
      subscription_data: {
        metadata: { empresa_id: empresaId, plano },
      },
    })

    return res.status(200).json({ url: session.url })

  } catch (err) {
    console.error('[checkout] erro inesperado:', err?.message || err)
    return res.status(500).json({ erro: err?.message || 'Erro interno ao criar sessão de pagamento' })
  }
}
