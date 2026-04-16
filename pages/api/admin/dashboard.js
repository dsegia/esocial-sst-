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

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ erro: 'Não autenticado' })

  const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ erro: 'Sessão inválida' })
  if (user.email !== adminEmail) return res.status(403).json({ erro: 'Acesso restrito' })

  const sb = createClient(supabaseUrl, serviceKey)

  const mesAtual = new Date()
  const inicioMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1).toISOString()
  const inicioMesPassado = new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1).toISOString()

  try {
    // Busca todas as empresas — usa nomes reais das colunas (criado_em, ativo)
    const { data: empresas, error: errEmp } = await sb
      .from('empresas')
      .select('id, razao_social, cnpj, plano, trial_inicio, ativo, criado_em')
      .order('criado_em', { ascending: false })

    if (errEmp) throw new Error('Erro ao buscar empresas: ' + errEmp.message)

    const empresaIds = (empresas || []).map(e => e.id)

    // Transmissões do mês atual — status real: pendente | enviado | rejeitado | lote
    const { data: transAtual } = await sb
      .from('transmissoes')
      .select('empresa_id, status, criado_em, evento')
      .gte('criado_em', inicioMes)
      .in('empresa_id', empresaIds.length > 0 ? empresaIds : ['00000000-0000-0000-0000-000000000000'])

    // Transmissões do mês passado (comparação)
    const { data: transPassado } = await sb
      .from('transmissoes')
      .select('empresa_id, status')
      .gte('criado_em', inicioMesPassado)
      .lt('criado_em', inicioMes)
      .in('empresa_id', empresaIds.length > 0 ? empresaIds : ['00000000-0000-0000-0000-000000000000'])

    // Responsáveis via usuario_empresas + usuarios
    const { data: usuarioEmpresas } = await sb
      .from('usuario_empresas')
      .select('empresa_id, usuario_id, perfil')
      .in('empresa_id', empresaIds.length > 0 ? empresaIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('perfil', 'admin')

    const { data: usuarios } = await sb
      .from('usuarios')
      .select('id, nome')

    // Email dos usuários via auth (service role permite)
    const { data: authUsers } = await sb.auth.admin.listUsers()
    const mapAuthEmail = {}
    for (const au of (authUsers?.users || [])) {
      mapAuthEmail[au.id] = au.email
    }

    // Funcionários ativos por empresa
    const { data: funcionarios } = empresaIds.length > 0
      ? await sb.from('funcionarios').select('empresa_id').eq('ativo', true).in('empresa_id', empresaIds)
      : { data: [] }

    // Últimas 20 transmissões
    const { data: recentes } = await sb
      .from('transmissoes')
      .select('id, empresa_id, evento, status, criado_em, erro_descricao')
      .order('criado_em', { ascending: false })
      .limit(20)

    // Mapas de métricas
    const mapTrans = {}
    const mapTransPassado = {}
    const mapFuncs = {}
    const mapUsuario = {}

    for (const t of (transAtual || [])) {
      if (!mapTrans[t.empresa_id]) mapTrans[t.empresa_id] = { total: 0, pendente: 0, erro: 0, enviado: 0 }
      mapTrans[t.empresa_id].total++
      if (t.status === 'pendente')   mapTrans[t.empresa_id].pendente++
      if (t.status === 'rejeitado')  mapTrans[t.empresa_id].erro++
      if (t.status === 'enviado')    mapTrans[t.empresa_id].enviado++
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
        if (u) mapUsuario[ue.empresa_id] = {
          nome: u.nome,
          email: mapAuthEmail[u.id] || '',
        }
      }
    }

    // Enriquece empresas
    const empresasEnriquecidas = (empresas || []).map(emp => {
      const trans = mapTrans[emp.id] || { total: 0, pendente: 0, erro: 0, enviado: 0 }
      const transAnterior = mapTransPassado[emp.id] || 0
      const variacao = transAnterior > 0
        ? Math.round(((trans.total - transAnterior) / transAnterior) * 100)
        : null
      return {
        id: emp.id,
        razao_social: emp.razao_social,
        cnpj: emp.cnpj,
        plano: emp.plano,
        bloqueado: !emp.ativo,               // ativo=false significa bloqueado
        created_at: emp.criado_em,
        trans_mes: trans.total,
        trans_pendente: trans.pendente,
        trans_erro: trans.erro,
        trans_transmitido: trans.enviado,
        trans_mes_passado: transAnterior,
        variacao_pct: variacao,
        funcionarios: mapFuncs[emp.id] || 0,
        responsavel: mapUsuario[emp.id] || null,
        trial_restante: emp.plano === 'trial' && emp.trial_inicio
          ? Math.max(0, 14 - Math.ceil((Date.now() - new Date(emp.trial_inicio).getTime()) / 86400000))
          : null,
      }
    })

    // Enriquece transmissões recentes
    const mapEmp = {}
    for (const e of (empresas || [])) mapEmp[e.id] = e.razao_social

    const recentesEnriquecidas = (recentes || []).map(t => ({
      id: t.id,
      empresa_id: t.empresa_id,
      empresa_nome: mapEmp[t.empresa_id] || t.empresa_id,
      evento: t.evento,
      status: t.status,
      created_at: t.criado_em,
      erro: t.erro_descricao || null,
    }))

    const totalEmpresas = empresas?.length || 0
    const totalTrans    = (transAtual || []).length
    const totalPendente = (transAtual || []).filter(t => t.status === 'pendente').length
    const totalErros    = (transAtual || []).filter(t => t.status === 'rejeitado').length
    const totalFuncs    = Object.values(mapFuncs).reduce((a, b) => a + b, 0)

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
