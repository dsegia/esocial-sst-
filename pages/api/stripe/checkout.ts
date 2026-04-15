import type { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Price IDs criados no painel do Stripe — configure no .env
const PRICE_IDS: Record<string, string> = {
  starter:    process.env.STRIPE_PRICE_STARTER!,
  pro:        process.env.STRIPE_PRICE_PRO!,
  business:   process.env.STRIPE_PRICE_BUSINESS!,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE!,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { plano, empresa_id, user_email } = req.body as {
    plano: string
    empresa_id: string
    user_email: string
  }

  if (!plano || !empresa_id || !user_email) {
    return res.status(400).json({ error: 'plano, empresa_id e user_email são obrigatórios' })
  }

  const priceId = PRICE_IDS[plano]
  if (!priceId) return res.status(400).json({ error: 'Plano inválido: ' + plano })

  // Busca ou cria o customer Stripe vinculado à empresa
  const { data: empresa } = await supabaseAdmin
    .from('empresas')
    .select('stripe_customer_id, razao_social')
    .eq('id', empresa_id)
    .single()

  let customerId = empresa?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user_email,
      name: empresa?.razao_social || undefined,
      metadata: { empresa_id },
    })
    customerId = customer.id

    await supabaseAdmin
      .from('empresas')
      .update({ stripe_customer_id: customerId })
      .eq('id', empresa_id)
  }

  const origin = req.headers.origin || process.env.NEXT_PUBLIC_APP_URL || 'https://esocialsst.com.br'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/conta?sucesso=1&plano=${plano}`,
    cancel_url:  `${origin}/conta?cancelado=1`,
    metadata: { empresa_id, plano },
    subscription_data: {
      metadata: { empresa_id, plano },
    },
    locale: 'pt-BR',
    allow_promotion_codes: true,
  })

  return res.status(200).json({ url: session.url })
}
