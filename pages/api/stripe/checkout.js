// pages/api/stripe/checkout.js
//
// Stripe setup necessário para cada plano:
//   1. Criar um Price recorrente mensal (flat rate) → STRIPE_PRICE_<PLANO>
//   2. Criar um Price recorrente metered com aggregate_usage=sum → STRIPE_PRICE_<PLANO>_EXCEDENTE
//      (unit_amount em centavos: micro=190, starter=150, pro=120)
//
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const PLANOS = {
  micro: {
    nome: 'Micro',
    priceId: process.env.STRIPE_PRICE_MICRO,
    priceIdExcedente: process.env.STRIPE_PRICE_MICRO_EXCEDENTE,
    creditos: 50,
    maxFuncionarios: 50,
  },
  starter: {
    nome: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER,
    priceIdExcedente: process.env.STRIPE_PRICE_STARTER_EXCEDENTE,
    creditos: 100,
    maxFuncionarios: 200,
  },
  pro: {
    nome: 'Pro',
    priceId: process.env.STRIPE_PRICE_PRO,
    priceIdExcedente: process.env.STRIPE_PRICE_PRO_EXCEDENTE,
    creditos: 400,
    maxFuncionarios: 1000,
  },
  // Planos legados mantidos para assinantes existentes
  professional: {
    nome: 'Professional',
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL,
    priceIdExcedente: null,
    creditos: 100,
    maxFuncionarios: 200,
  },
  business: {
    nome: 'Business',
    priceId: process.env.STRIPE_PRICE_BUSINESS,
    priceIdExcedente: null,
    creditos: 9999,
    maxFuncionarios: 500,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://esocial-sst.vercel.app'

    if (!stripeKey) return res.status(500).json({ erro: 'STRIPE_SECRET_KEY não configurada' })

    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ erro: 'Não autenticado' })

    const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ erro: 'Sessão inválida' })

    const sbAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data: usuarioDb } = await sbAdmin.from('usuarios')
      .select('empresa_id').eq('id', user.id).single()
    const empresaId = usuarioDb?.empresa_id || user.user_metadata?.empresa_id

    if (!empresaId) return res.status(403).json({ erro: 'Empresa não encontrada para este usuário' })

    const { plano } = req.body
    const planoInfo = PLANOS[plano]
    if (!planoInfo) return res.status(400).json({ erro: `Plano inválido: "${plano}"` })
    if (!planoInfo.priceId) return res.status(500).json({ erro: `Price ID não configurado para ${plano}` })

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' })
    const { data: empresa } = await sbAdmin.from('empresas')
      .select('id, razao_social, cnpj, stripe_customer_id').eq('id', empresaId).single()

    let customerId = empresa?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: empresa?.razao_social || user.email,
        metadata: { empresa_id: empresaId, cnpj: empresa?.cnpj || '' },
      })
      customerId = customer.id
      await sbAdmin.from('empresas').update({ stripe_customer_id: customerId }).eq('id', empresaId)
    }

    // Monta line_items: base + metered (excedente) quando disponível
    const lineItems = [{ price: planoInfo.priceId, quantity: 1 }]
    if (planoInfo.priceIdExcedente) {
      lineItems.push({ price: planoInfo.priceIdExcedente })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card', 'boleto'],
      line_items: lineItems,
      success_url: `${siteUrl}/dashboard?upgrade=ok&plano=${plano}`,
      cancel_url: `${siteUrl}/planos?cancelado=1`,
      metadata: { empresa_id: empresaId, plano },
      subscription_data: {
        metadata: { empresa_id: empresaId, plano },
      },
    })

    return res.status(200).json({ url: session.url })

  } catch (err) {
    console.error('[checkout] erro:', err?.message || err)
    return res.status(500).json({ erro: err?.message || 'Erro interno ao criar sessão de pagamento' })
  }
}
