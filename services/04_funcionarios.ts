import { supabase } from '../lib/supabase'
import type { Funcionario } from '../types/database'

// ─── LISTAR ──────────────────────────────────────────────
export async function listarFuncionarios(empresaId: string, filtros?: {
  busca?: string
  setor?: string
  ativo?: boolean
}) {
  let query = supabase
    .from('funcionarios')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('ativo', filtros?.ativo ?? true)
    .order('nome')

  if (filtros?.busca) {
    query = query.or(
      `nome.ilike.%${filtros.busca}%,cpf.ilike.%${filtros.busca}%,matricula_esocial.ilike.%${filtros.busca}%`
    )
  }
  if (filtros?.setor) {
    query = query.eq('setor', filtros.setor)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Funcionario[]
}

// ─── BUSCAR POR ID ───────────────────────────────────────
export async function buscarFuncionario(id: string) {
  const { data, error } = await supabase
    .from('funcionarios')
    .select(`
      *,
      asos(id, tipo_aso, data_exame, prox_exame, conclusao),
      cats(id, tipo_cat, dt_acidente, cid),
      transmissoes(id, evento, status, dt_envio, recibo)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// ─── CRIAR ───────────────────────────────────────────────
export async function criarFuncionario(
  empresaId: string,
  dados: Omit<Funcionario, 'id' | 'empresa_id' | 'ativo' | 'criado_em'>
) {
  // Verifica CPF duplicado na mesma empresa
  const { data: existente } = await supabase
    .from('funcionarios')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('cpf', dados.cpf)
    .single()

  if (existente) throw new Error(`CPF ${dados.cpf} já está cadastrado nesta empresa.`)

  const { data, error } = await supabase
    .from('funcionarios')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ ...dados, empresa_id: empresaId } as any)
    .select()
    .single()

  if (error) throw error
  return data as Funcionario
}

// ─── ATUALIZAR ───────────────────────────────────────────
export async function atualizarFuncionario(id: string, dados: Partial<Funcionario>) {
  const { data, error } = await supabase
    .from('funcionarios')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(dados as any)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Funcionario
}

// ─── DESATIVAR (soft delete) ─────────────────────────────
export async function desativarFuncionario(id: string) {
  const { error } = await supabase
    .from('funcionarios')
    .update({ ativo: false })
    .eq('id', id)

  if (error) throw error
}

// ─── IMPORTAÇÃO EM LOTE ─────────────────────────────────
// Recebe linhas já parseadas da planilha e faz upsert inteligente:
// - CPF novo → INSERT
// - CPF existente com dados diferentes → UPDATE
// - CPF existente sem diferença → ignora
export async function importarFuncionarios(
  empresaId: string,
  linhas: Array<Partial<Funcionario>>
) {
  const resultado = { novos: 0, atualizados: 0, ignorados: 0, erros: [] as string[] }

  // Busca todos os CPFs existentes da empresa
  const { data: existentes } = await supabase
    .from('funcionarios')
    .select('id, cpf, nome, funcao, setor, matricula_esocial')
    .eq('empresa_id', empresaId)

  const mapExistentes = new Map(existentes?.map(f => [f.cpf.replace(/\D/g, ''), f]) || [])

  for (const linha of linhas) {
    if (!linha.cpf || !linha.nome) continue
    const cpfRaw = linha.cpf.replace(/\D/g, '')

    try {
      const existente = mapExistentes.get(cpfRaw)

      if (!existente) {
        // NOVO
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await supabase.from('funcionarios').insert({
          empresa_id: empresaId,
          nome: linha.nome!,
          cpf: linha.cpf!,
          data_nasc: linha.data_nasc!,
          data_adm: linha.data_adm!,
          matricula_esocial: linha.matricula_esocial!,
          funcao: linha.funcao,
          setor: linha.setor,
          salario: linha.salario,
          vinculo: linha.vinculo || 'CLT',
          turno: linha.turno || 'Diurno',
        } as any)
        resultado.novos++
      } else {
        // Verifica se há diferença
        const mudou = existente.nome !== linha.nome
          || existente.funcao !== linha.funcao
          || existente.setor !== linha.setor
          || existente.matricula_esocial !== linha.matricula_esocial

        if (mudou) {
          await supabase.from('funcionarios').update({
            nome: linha.nome,
            funcao: linha.funcao,
            setor: linha.setor,
            matricula_esocial: linha.matricula_esocial,
          }).eq('id', existente.id)
          resultado.atualizados++
        } else {
          resultado.ignorados++
        }
      }
    } catch (e: unknown) {
      resultado.erros.push(`${linha.nome}: ${e instanceof Error ? e.message : 'Erro desconhecido'}`)
    }
  }

  return resultado
}

// ─── SETORES ÚNICOS (para filtro) ───────────────────────
export async function listarSetores(empresaId: string) {
  const { data } = await supabase
    .from('funcionarios')
    .select('setor')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .not('setor', 'is', null)

  const setores = [...new Set(data?.map(f => f.setor).filter(Boolean))]
  return setores.sort() as string[]
}
