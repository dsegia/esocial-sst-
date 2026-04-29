import { supabase } from '../lib/supabase'
import type { ASO, LTCAT, CAT, Transmissao } from '../types/database'

// ════════════════════════════════════════
//  ASOs
// ════════════════════════════════════════

export async function salvarASO(dados: Omit<ASO, 'id' | 'criado_em'>) {
  const { data, error } = await supabase
    .from('asos')
    .insert(dados)
    .select()
    .single()
  if (error) throw error
  return data as ASO
}

export async function listarASOsDoFuncionario(funcId: string) {
  const { data, error } = await supabase
    .from('asos')
    .select('*')
    .eq('funcionario_id', funcId)
    .order('data_exame', { ascending: false })
  if (error) throw error
  return data as ASO[]
}

export async function ultimoASO(funcId: string) {
  const { data } = await supabase
    .from('asos')
    .select('*')
    .eq('funcionario_id', funcId)
    .order('data_exame', { ascending: false })
    .limit(1)
    .single()
  return data as ASO | null
}

// ════════════════════════════════════════
//  LTCATs
// ════════════════════════════════════════

export async function salvarLTCAT(dados: Omit<LTCAT, 'id' | 'criado_em'>) {
  // Desativa o LTCAT anterior da empresa (soft replace)
  await supabase
    .from('ltcats')
    .update({ ativo: false })
    .eq('empresa_id', dados.empresa_id)
    .eq('ativo', true)

  const { data, error } = await supabase
    .from('ltcats')
    .insert(dados)
    .select()
    .single()
  if (error) throw error
  return data as LTCAT
}

export async function ltcatVigente(empresaId: string) {
  const { data } = await supabase
    .from('ltcats')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('data_emissao', { ascending: false })
    .limit(1)
    .single()
  return data as LTCAT | null
}

// ════════════════════════════════════════
//  CATs
// ════════════════════════════════════════

export async function salvarCAT(dados: Omit<CAT, 'id' | 'criado_em'>) {
  const { data, error } = await supabase
    .from('cats')
    .insert(dados)
    .select()
    .single()
  if (error) throw error
  return data as CAT
}

// ════════════════════════════════════════
//  TRANSMISSÕES
// ════════════════════════════════════════

export async function salvarTransmissao(dados: Omit<Transmissao, 'id' | 'criado_em'>) {
  const { data, error } = await supabase
    .from('transmissoes')
    .insert(dados)
    .select()
    .single()
  if (error) throw error
  return data as Transmissao
}

export async function atualizarTransmissao(id: string, dados: Partial<Transmissao>) {
  const { data, error } = await supabase
    .from('transmissoes')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(dados as any)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Transmissao
}

export async function listarTransmissoes(empresaId: string, filtros?: {
  evento?: string
  status?: string
  limite?: number
}) {
  let query = supabase
    .from('transmissoes')
    .select('*, funcionarios(nome, cpf, matricula_esocial)')
    .eq('empresa_id', empresaId)
    .order('criado_em', { ascending: false })
    .limit(filtros?.limite || 100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (filtros?.evento) query = query.eq('evento', filtros.evento as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (filtros?.status) query = query.eq('status', filtros.status as any)

  const { data, error } = await query
  if (error) throw error
  return data
}

// ════════════════════════════════════════
//  ALERTAS DE VENCIMENTO
// ════════════════════════════════════════

export async function alertasVencimento(empresaId: string, diasAtencao = 60) {
  const { data, error } = await supabase.rpc('get_alertas_vencimento', {
    p_empresa_id: empresaId,
  })
  if (error) throw error
  return (data || []) as Array<{
    funcionario_id: string
    nome: string
    matricula: string
    setor: string
    tipo_alerta: string
    data_venc: string
    dias_restantes: number
  }>
}

// ════════════════════════════════════════
//  DASHBOARD — KPIs agregados
// ════════════════════════════════════════

export async function kpisDashboard(empresaId: string) {
  const hoje = new Date().toISOString().split('T')[0]
  const em60dias = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]

  const [funcs, txs, asos, ltcat] = await Promise.all([
    supabase.from('funcionarios').select('id', { count: 'exact' }).eq('empresa_id', empresaId).eq('ativo', true),
    supabase.from('transmissoes').select('status', { count: 'exact' }).eq('empresa_id', empresaId),
    supabase.from('asos').select('id, prox_exame, conclusao').eq('empresa_id', empresaId),
    supabase.from('ltcats').select('id, prox_revisao, ativo').eq('empresa_id', empresaId).eq('ativo', true),
  ])

  const totalFuncs = funcs.count || 0
  const totalTx = txs.data?.length || 0
  const enviados = txs.data?.filter(t => t.status === 'enviado' || t.status === 'lote').length || 0
  const rejeitados = txs.data?.filter(t => t.status === 'rejeitado').length || 0

  const asosVencidos = asos.data?.filter(a => a.prox_exame && a.prox_exame < hoje).length || 0
  const asosAVencer = asos.data?.filter(a => a.prox_exame && a.prox_exame >= hoje && a.prox_exame <= em60dias).length || 0
  const asosOk = asos.data?.filter(a => a.prox_exame && a.prox_exame > em60dias).length || 0

  return {
    totalFuncionarios: totalFuncs,
    totalTransmissoes: totalTx,
    taxaSucesso: totalTx > 0 ? Math.round((enviados / totalTx) * 100) : 0,
    transmissoesRejeitadas: rejeitados,
    asosVencidos,
    asosAVencer,
    asosEmDia: asosOk,
    ltcatVigenteCount: ltcat.data?.length || 0,
    conformidade: totalFuncs > 0 ? Math.round((asosOk / totalFuncs) * 100) : 0,
  }
}
