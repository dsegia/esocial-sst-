import type { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { buffer } from 'micro'

export const config = { api: { bodyParser: false } }

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CREDITOS_POR_PLANO: Record<string, number> = {
  micro:        50,
  starter:      100,
  pro:          400,
  professional: 100,
  business:     9999,
  enterprise:   9999,
}

const MAX_FUNCIONARIOS: Record<string, number> = {
  micro:        999999,
  starter:      999999,
  pro:          999999,
  professional: 999999,
  business:     999999,
  enterprise:   999999,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const sig = req.headers['stripe-signature'] as string
  const rawBody = await buffer(req)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature error:', err.message)
    return res.status(400).json({ error: 'Webhook inválido.' })
  }

  const empresaIdDe = (obj: { metadata?: Stripe.Metadata | null }) =>
    obj.metadata?.empresa_id as string | undefined

  switch (event.type) {

    // Assinatura criada / atualizada
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const plano = sub.metadata?.plano as string
      const empresaId = empresaIdDe(sub)
      if (!empresaId || !plano) break

      const ativo = sub.status === 'active' || sub.status === 'trialing'
      const expira = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null

      const creditosIncluidos = CREDITOS_POR_PLANO[plano] ?? 0

      // Extrai o subscription item metered (excedente), se presente
      const meteredItem = (sub.items?.data ?? []).find(
        (item: any) => item.price?.recurring?.usage_type === 'metered'
      )

      await supabaseAdmin
        .from('empresas')
        .update({
          plano: ativo ? plano : 'cancelado',
          plano_expira_em: expira,
          stripe_subscription_id: sub.id,
          max_funcionarios: ativo ? (MAX_FUNCIONARIOS[plano] ?? 50) : 0,
          creditos_incluidos: ativo ? creditosIncluidos : 0,
          creditos_restantes: ativo ? creditosIncluidos : 0,
          stripe_metered_item_id: meteredItem?.id ?? null,
        })
        .eq('id', empresaId)

      break
    }

    // Assinatura cancelada / expirada
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const empresaId = empresaIdDe(sub)
      if (!empresaId) break

      await supabaseAdmin
        .from('empresas')
        .update({
          plano: 'cancelado',
          plano_expira_em: null,
          stripe_subscription_id: null,
          stripe_metered_item_id: null,
          max_funcionarios: 0,
          creditos_restantes: 0,
          creditos_incluidos: 0,
        })
        .eq('id', empresaId)

      break
    }

    // Fatura paga — renova créditos do ciclo mensal
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = invoice.subscription as string
      if (!subscriptionId) break

      const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('id, creditos_incluidos')
        .eq('stripe_subscription_id', subscriptionId)
        .single()

      if (empresa && empresa.creditos_incluidos > 0) {
        await supabaseAdmin
          .from('empresas')
          .update({ creditos_restantes: empresa.creditos_incluidos })
          .eq('id', empresa.id)
      }
      break
    }

    // Pagamento falhou — notifica por e-mail
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('id, razao_social')
        .eq('stripe_customer_id', customerId)
        .single()

      if (empresa) {
        const { data: usuario } = await supabaseAdmin
          .from('usuarios')
          .select('id')
          .eq('empresa_id', empresa.id)
          .eq('perfil', 'admin')
          .single()

        if (usuario) {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(usuario.id)
          const email = authUser?.user?.email
          if (email) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'eSocial SST <noreply@esocialsst.com.br>',
                to: email,
                subject: 'Falha no pagamento — eSocial SST',
                html: `
                  <p>Olá,</p>
                  <p>Houve uma falha no pagamento da assinatura de <strong>${empresa.razao_social}</strong>.</p>
                  <p>Por favor, atualize o seu método de pagamento para continuar usando o sistema:</p>
                  <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/conta">Acessar minha conta</a></p>
                  <p>Atenciosamente,<br/>eSocial SST</p>
                `,
              }),
            })
          }
        }
      }
      break
    }

    default:
      break
  }

  return res.status(200).json({ received: true })
}
