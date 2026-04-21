// pages/api/notificar-vencimento.js
// Envia e-mails de alerta de vencimento de ASO via Resend
// Variável necessária: RESEND_API_KEY (gratuito até 3.000 e-mails/mês)
// Pode ser chamado manualmente ou via cron

import { createClient } from '@supabase/supabase-js'
import { requireEmpresaAccess } from '../../lib/auth-middleware'
import { checkRateLimit, getClientIP } from '../../lib/rate-limit'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const ip = getClientIP(req)
  const { limited, retryAfter } = checkRateLimit(ip, { windowMs: 60_000, max: 5 })
  if (limited) {
    res.setHeader('Retry-After', String(retryAfter))
    return res.status(429).json({ erro: 'Muitas requisições. Tente novamente em breve.' })
  }

  const { empresa_id, email_destino, dias_aviso = 30, modo = 'preview' } = req.body
  if (!empresa_id) return res.status(400).json({ erro: 'empresa_id obrigatório' })

  // Valida que o usuário autenticado tem acesso à empresa solicitada
  const acesso = await requireEmpresaAccess(req, res, empresa_id, ['admin'])
  if (!acesso) return

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const { data: empresa } = await sb
      .from('empresas')
      .select('razao_social, cnpj')
      .eq('id', empresa_id)
      .single()

    if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada' })

    const { data: alertas } = await sb
      .rpc('get_alertas_vencimento', { p_empresa_id: empresa_id })

    if (!alertas || alertas.length === 0) {
      return res.status(200).json({ sucesso: true, enviados: 0, mensagem: 'Nenhum alerta pendente.' })
    }

    const relevantes = alertas.filter(a =>
      a.tipo_alerta === 'Sem ASO' ||
      a.tipo_alerta === 'ASO vencido' ||
      (a.dias_restantes >= 0 && a.dias_restantes <= dias_aviso)
    )

    if (relevantes.length === 0) {
      return res.status(200).json({ sucesso: true, enviados: 0, mensagem: 'Nenhum vencimento nos próximos ' + dias_aviso + ' dias.' })
    }

    const hoje = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })
    const vencidos  = relevantes.filter(a => a.dias_restantes < 0 || a.tipo_alerta === 'ASO vencido')
    const criticos  = relevantes.filter(a => a.dias_restantes >= 0 && a.dias_restantes <= 15)
    const atencao   = relevantes.filter(a => a.dias_restantes > 15 && a.dias_restantes <= dias_aviso)
    const semAso    = relevantes.filter(a => a.tipo_alerta === 'Sem ASO')

    function linhasTabela(lista) {
      return lista.map(a => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${a.nome}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280">${a.setor || '—'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:12px">${a.matricula || '—'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center">
            ${a.tipo_alerta === 'Sem ASO' ? '<span style="color:#E24B4A">Sem ASO</span>' :
              a.dias_restantes < 0 ? `<span style="color:#E24B4A">Vencido há ${Math.abs(a.dias_restantes)}d</span>` :
              `<span style="color:${a.dias_restantes <= 15 ? '#E24B4A' : '#EF9F27'}">${a.dias_restantes}d</span>`}
          </td>
        </tr>`).join('')
    }

    const htmlEmail = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

  <!-- Header -->
  <tr><td style="background:#185FA5;padding:24px 32px">
    <div style="color:#fff;font-size:18px;font-weight:bold">eSocial SST — Alerta de Vencimento</div>
    <div style="color:#B5D4F4;font-size:13px;margin-top:4px">${empresa.razao_social} · ${hoje}</div>
  </td></tr>

  <!-- Resumo -->
  <tr><td style="padding:24px 32px">
    <p style="font-size:14px;color:#374151;margin:0 0 16px">
      Foram identificados <strong>${relevantes.length} funcionário(s)</strong> com situação de ASO que requer atenção:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      <tr>
        ${vencidos.length ? `<td align="center" style="background:#FCEBEB;border-radius:8px;padding:12px;margin:4px"><div style="font-size:22px;font-weight:bold;color:#E24B4A">${vencidos.length}</div><div style="font-size:11px;color:#791F1F">Vencidos</div></td>` : ''}
        ${semAso.length ? `<td width="8"></td><td align="center" style="background:#f3f4f6;border-radius:8px;padding:12px"><div style="font-size:22px;font-weight:bold;color:#6b7280">${semAso.length}</div><div style="font-size:11px;color:#6b7280">Sem ASO</div></td>` : ''}
        ${criticos.length ? `<td width="8"></td><td align="center" style="background:#FCEBEB;border-radius:8px;padding:12px"><div style="font-size:22px;font-weight:bold;color:#E24B4A">${criticos.length}</div><div style="font-size:11px;color:#791F1F">Críticos (≤15d)</div></td>` : ''}
        ${atencao.length ? `<td width="8"></td><td align="center" style="background:#FAEEDA;border-radius:8px;padding:12px"><div style="font-size:22px;font-weight:bold;color:#EF9F27">${atencao.length}</div><div style="font-size:11px;color:#633806">Atenção</div></td>` : ''}
      </tr>
    </table>

    <!-- Tabela de funcionários -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Funcionário</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Setor</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Matrícula</th>
          <th style="padding:8px 12px;text-align:center;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Situação</th>
        </tr>
      </thead>
      <tbody>
        ${linhasTabela(relevantes.slice(0, 20))}
        ${relevantes.length > 20 ? `<tr><td colspan="4" style="padding:8px 12px;color:#9ca3af;font-size:12px;text-align:center">+${relevantes.length - 20} funcionários adicionais — acesse o sistema para ver todos</td></tr>` : ''}
      </tbody>
    </table>

    <div style="margin-top:20px;text-align:center">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://esocial-sst.vercel.app'}/alertas"
        style="display:inline-block;padding:12px 24px;background:#185FA5;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:bold">
        Ver alertas no sistema →
      </a>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
    <p style="font-size:11px;color:#9ca3af;margin:0;text-align:center">
      eSocial SST Transmissor · Este é um e-mail automático, não responda.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

    if (modo === 'preview') {
      return res.status(200).json({
        sucesso: true,
        preview: true,
        total_alertas: relevantes.length,
        html: htmlEmail,
        destinatario: email_destino,
      })
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(200).json({
        sucesso: false,
        erro: 'RESEND_API_KEY não configurada. Adicione em Configurações > E-mail ou nas variáveis de ambiente da Vercel.',
        preview_disponivel: true,
        total_alertas: relevantes.length,
      })
    }

    if (!email_destino) {
      return res.status(400).json({ erro: 'email_destino obrigatório para modo=enviar' })
    }

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'eSocial SST <noreply@esocialsst.com.br>',
        to: [email_destino],
        subject: `⚠ ${relevantes.length} ASO(s) com vencimento — ${empresa.razao_social}`,
        html: htmlEmail,
      }),
    })

    const resendData = await resendResp.json()

    if (!resendResp.ok) {
      console.error('[notificar-vencimento] Resend error:', resendData)
      return res.status(500).json({ erro: 'Erro ao enviar e-mail. Tente novamente.' })
    }

    return res.status(200).json({
      sucesso: true,
      enviados: 1,
      total_alertas: relevantes.length,
      email_id: resendData.id,
    })

  } catch (err) {
    console.error('[notificar-vencimento]', err)
    return res.status(500).json({ erro: 'Erro interno do servidor.' })
  }
}
