// pages/api/admin/dashboard.js
// Rota protegida — apenas o e-mail definido em ADMIN_EMAIL pode acessar
// Usa SUPABASE_SERVICE_ROLE_KEY para bypassar RLS e ver todos os dados

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' })

  const adminEmail = process.env.ADMIN_EMAIL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!adminEmail || !serviceKey) {
    return res.status(500).json({ erro: 'Variáveis ADMIN_EMAIL e SUPABASE_SERVICE_ROLE_KEY não configuradas' })
  }

  // Valida o token do usuário logado
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ erro: 'Não autenticado' })

  // Verifica a sessão com a anon key (seguro para validação)
  const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ erro: 'Sessão inválida' })
  if (user.email !== adminEmail) return res.status(403).json({ erro: 'Acesso restrito' })

  // A partir daqui usa service role (bypassa RLS)
  const sb = createClient(supabaseUrl, serviceKey)

  const mesAtual = new Date()
  const inicioMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1).toISOString()
  const inicioMesPassado = new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1).toISOString()

  try {
    // Busca todas as empresas com usuário responsável
    const { data: empresas } = await sb
      .from('empresas')
      .select('id, razao_social, cnpj, plano, trial_inicio, bloqueado, created_at')
      .order('created_at', { ascending: false })

    const empresaIds = (empresas || []).map(e => e.id)

    // Transmissões do mês atual por empresa
    const { data: transAtual } = await sb
      .from('transmissoes')
      .select('empresa_id, status, created_at, evento')
      .gte('created_at', inicioMes)
      .in('empresa_id', empresaIds)

    // Transmissões do mês passado (para comparação)
    const { data: transPassado } = await sb
      .from('transmissoes')
      .select('empresa_id, status')
      .gte('created_at', inicioMesPassado)
      .lt('created_at', inicioMes)
      .in('empresa_id', empresaIds)

    // Usuários por empresa (responsável)
    const { data: usuarioEmpresas } = await sb
      .from('usuario_empresas')
      .select('empresa_id, usuario_id, perfil')
      .in('empresa_id', empresaIds)
      .eq('perfil', 'admin')

    const { data: usuarios } = await sb
      .from('usuarios')
      .select('id, nome, email')

    // Funcionários ativos por empresa
    const { data: funcionarios } = await sb
      .from('funcionarios')
      .select('empresa_id')
      .eq('ativo', true)
      .in('empresa_id', empresaIds)

    // Últimas 20 transmissões (qualquer empresa)
    const { data: recentes } = await sb
      .from('transmissoes')
      .select('id, empresa_id, evento, status, created_at, erro')
      .order('created_at', { ascending: false })
      .limit(20)

    // Monta mapa de métricas por empresa
    const mapTrans = {}
    const mapTransPassado = {}
    const mapFuncs = {}
    const mapUsuario = {}

    for (const t of (transAtual || [])) {
      if (!mapTrans[t.empresa_id]) mapTrans[t.empresa_id] = { total: 0, pendente: 0, erro: 0, transmitido: 0 }
      mapTrans[t.empresa_id].total++
      if (t.status === 'pendente')    mapTrans[t.empresa_id].pendente++
      if (t.status === 'erro')        mapTrans[t.empresa_id].erro++
      if (t.status === 'transmitido') mapTrans[t.empresa_id].transmitido++
    }

    for (const t of (transPassado || [])) {
      mapTransPassado[t.empresa_id] = (mapTransPassado[t.empresa_id] || 0) + 1
    }

    for (const f of (funcionarios || [])) {
      mapFuncs[f.empresa_id] = (mapFuncs[f.empresa_id] || 0) + 1
    }

    for (const ue of (usuarioEmpresas || [])) {
      if (!mapUsuario[ue.empresa_id]) {
        const u = (usuarios || []).find(u => u.id === ue.usuario_id)
        if (u) mapUsuario[ue.empresa_id] = { nome: u.nome, email: u.email }
      }
    }

    // Enriquece empresas com métricas
    const empresasEnriquecidas = (empresas || []).map(emp => {
      const trans = mapTrans[emp.id] || { total: 0, pendente: 0, erro: 0, transmitido: 0 }
      const transAnterior = mapTransPassado[emp.id] || 0
      const variacao = transAnterior > 0
        ? Math.round(((trans.total - transAnterior) / transAnterior) * 100)
        : null
      return {
        ...emp,
        bloqueado: emp.bloqueado || false,
        trans_mes: trans.total,
        trans_pendente: trans.pendente,
        trans_erro: trans.erro,
        trans_transmitido: trans.transmitido,
        trans_mes_passado: transAnterior,
        variacao_pct: variacao,
        funcionarios: mapFuncs[emp.id] || 0,
        responsavel: mapUsuario[emp.id] || null,
        trial_restante: emp.plano === 'trial' && emp.trial_inicio
          ? Math.max(0, 14 - Math.ceil((Date.now() - new Date(emp.trial_inicio).getTime()) / 86400000))
          : null,
      }
    })

    // Enriquece transmissões recentes com nome da empresa
    const mapEmp = {}
    for (const e of (empresas || [])) mapEmp[e.id] = e.razao_social

    const recentesEnriquecidas = (recentes || []).map(t => ({
      ...t,
      empresa_nome: mapEmp[t.empresa_id] || t.empresa_id,
    }))

    // Totais globais
    const totalEmpresas  = empresas?.length || 0
    const totalTrans     = (transAtual || []).length
    const totalPendente  = (transAtual || []).filter(t => t.status === 'pendente').length
    const totalErros     = (transAtual || []).filter(t => t.status === 'erro').length
    const totalFuncs     = Object.values(mapFuncs).reduce((a, b) => a + b, 0)

    return res.status(200).json({
      ok: true,
      totais: { empresas: totalEmpresas, trans_mes: totalTrans, pendente: totalPendente, erros: totalErros, funcionarios: totalFuncs },
      empresas: empresasEnriquecidas,
      recentes: recentesEnriquecidas,
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
}
