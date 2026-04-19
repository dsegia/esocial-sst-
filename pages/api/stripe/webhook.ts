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

const MAX_FUNCIONARIOS: Record<string, number> = {
  starter:    50,
  pro:        200,
  business:   500,
  enterprise: 999999,
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

    // Assinatura criada / ativada
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

      await supabaseAdmin
        .from('empresas')
        .update({
          plano: ativo ? plano : 'cancelado',
          plano_expira_em: expira,
          stripe_subscription_id: sub.id,
          max_funcionarios: ativo ? (MAX_FUNCIONARIOS[plano] ?? 50) : 0,
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
          max_funcionarios: 0,
        })
        .eq('id', empresaId)

      break
    }

    // Pagamento falhou — notifica por e-mail (Resend)
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('id, razao_social')
        .eq('stripe_customer_id', customerId)
        .single()

      if (empresa) {
        // Busca o e-mail do admin
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
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
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
      // Evento não tratado — ignora silenciosamente
      break
  }

  return res.status(200).json({ received: true })
}
