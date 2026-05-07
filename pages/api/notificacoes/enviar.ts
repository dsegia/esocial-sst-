import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function enviarEmail(to: string, subject: string, html: string) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'eSocial SST <noreply@esocialsst.com.br>',
      to,
      subject,
      html,
    }),
  })
  return resp.ok
}

// POST /api/notificacoes/enviar
// Body: { secret: string, empresa_id?: string }
// Se empresa_id omitido, dispara para todas as empresas ativas.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const { empresa_id, secret } = req.body || {}

  if (!process.env.NOTIFICACOES_SECRET || secret !== process.env.NOTIFICACOES_SECRET) {
    return res.status(401).json({ erro: 'Não autorizado' })
  }

  // Determinar quais empresas processar
  let empresaIds: string[] = []
  if (empresa_id) {
    empresaIds = [empresa_id]
  } else {
    const { data: ativas } = await supabaseAdmin
      .from('empresas')
      .select('id')
      .neq('plano', 'cancelado')
    empresaIds = (ativas || []).map((e: any) => e.id)
  }

  const resultados: Array<{ empresa_id: string; email?: string; pendencias: number; enviado: boolean }> = []

  for (const eId of empresaIds) {
    try {
      const resultado = await processarEmpresa(eId)
      resultados.push(resultado)
    } catch {
      resultados.push({ empresa_id: eId, pendencias: 0, enviado: false })
    }
  }

  const enviados  = resultados.filter(r => r.enviado).length
  const ignorados = resultados.filter(r => !r.enviado).length

  return res.status(200).json({ mensagem: `${enviados} e-mail(s) enviado(s), ${ignorados} sem pendências`, resultados })
}

async function processarEmpresa(empresaId: string) {
  const hoje = new Date()
  const em30 = new Date(hoje); em30.setDate(em30.getDate() + 30)
  const h3   = new Date(hoje); h3.setDate(h3.getDate() - 3)

  // Buscar admin da empresa
  const { data: admin } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome')
    .eq('empresa_id', empresaId)
    .eq('perfil', 'admin')
    .maybeSingle()

  if (!admin) return { empresa_id: empresaId, pendencias: 0, enviado: false }

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(admin.id)
  const email = authUser?.user?.email
  if (!email) return { empresa_id: empresaId, pendencias: 0, enviado: false }

  const { data: empresa } = await supabaseAdmin
    .from('empresas')
    .select('razao_social')
    .eq('id', empresaId)
    .single()

  // ASOs vencidos
  const { data: asoVencidos } = await supabaseAdmin
    .from('asos')
    .select('id, prox_exame, funcionarios(nome)')
    .eq('empresa_id', empresaId)
    .lt('prox_exame', hoje.toISOString().split('T')[0])

  // ASOs vencendo em até 30 dias
  const { data: asosVence30 } = await supabaseAdmin
    .from('asos')
    .select('id, prox_exame, funcionarios(nome)')
    .eq('empresa_id', empresaId)
    .gte('prox_exame', hoje.toISOString().split('T')[0])
    .lte('prox_exame', em30.toISOString().split('T')[0])

  // Transmissões pendentes há mais de 3 dias
  const { data: txPendentes } = await supabaseAdmin
    .from('transmissoes')
    .select('id, evento, criado_em')
    .eq('empresa_id', empresaId)
    .eq('status', 'pendente')
    .lt('criado_em', h3.toISOString())

  // Transmissões rejeitadas não corrigidas
  const { data: txRejeitadas } = await supabaseAdmin
    .from('transmissoes')
    .select('id, evento')
    .eq('empresa_id', empresaId)
    .eq('status', 'rejeitado')

  const itens: string[] = []

  if (asoVencidos && asoVencidos.length > 0) {
    const nomes = (asoVencidos as any[]).slice(0, 3).map(a => (a.funcionarios as any)?.nome?.split(' ')[0]).filter(Boolean).join(', ')
    itens.push(`<li>🚨 <strong>${asoVencidos.length} ASO(s) vencido(s)</strong>${nomes ? ` — ${nomes}${asoVencidos.length > 3 ? ' e outros' : ''}` : ''}</li>`)
  }
  if (txRejeitadas && txRejeitadas.length > 0) {
    itens.push(`<li>❌ <strong>${txRejeitadas.length} transmissão(ões) rejeitada(s)</strong> aguardando correção</li>`)
  }
  if (asosVence30 && asosVence30.length > 0) {
    itens.push(`<li>⏰ <strong>${asosVence30.length} ASO(s) vencendo em até 30 dias</strong></li>`)
  }
  if (txPendentes && txPendentes.length > 0) {
    itens.push(`<li>📡 <strong>${txPendentes.length} transmissão(ões) pendente(s)</strong> há mais de 3 dias</li>`)
  }

  if (itens.length === 0) return { empresa_id: empresaId, email, pendencias: 0, enviado: false }

  const razao = empresa?.razao_social || 'sua empresa'
  const subject = `[eSocial SST] ${itens.length} pendência(s) — ${razao}`

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:580px;margin:0 auto;color:#111">
  <div style="background:#185FA5;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px;font-weight:700">eSocial SST — Pendências</h2>
    <p style="color:#b3d4f0;margin:4px 0 0;font-size:13px">${razao}</p>
  </div>
  <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
    <p style="margin:0 0 12px;font-size:14px">Olá, <strong>${admin.nome}</strong>!</p>
    <p style="margin:0 0 12px;font-size:13px;color:#374151">
      As seguintes pendências foram identificadas em <strong>${razao}</strong>:
    </p>
    <ul style="padding-left:20px;line-height:2;font-size:13px;color:#374151;margin:0 0 20px">
      ${itens.join('\n')}
    </ul>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
      style="display:inline-block;padding:11px 22px;background:#185FA5;color:#fff;border-radius:7px;text-decoration:none;font-weight:500;font-size:13px">
      Acessar o painel →
    </a>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
    <p style="font-size:11px;color:#9ca3af;margin:0">
      eSocial SST Transmissor · Este é um e-mail automático de notificação de pendências.<br>
      Para desativar, acesse Configurações → Notificações.
    </p>
  </div>
</div>`

  const enviado = await enviarEmail(email, subject, html)
  return { empresa_id: empresaId, email, pendencias: itens.length, enviado }
}
