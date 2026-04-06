import { supabase } from '../lib/supabase'

// ─── LOGIN ───────────────────────────────────────────────
export async function login(email: string, senha: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw new Error(error.message)

  // Busca dados do usuário e empresa
  const { data: usuario, error: uErr } = await supabase
    .from('usuarios')
    .select('*, empresas(*)')
    .eq('id', data.user.id)
    .single()

  if (uErr || !usuario) throw new Error('Usuário não encontrado no sistema.')
  return { session: data.session, usuario }
}

// ─── LOGOUT ──────────────────────────────────────────────
export async function logout() {
  await supabase.auth.signOut()
}

// ─── SESSÃO ATUAL ────────────────────────────────────────
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ─── USUÁRIO LOGADO ──────────────────────────────────────
export async function getUsuarioAtual() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('usuarios')
    .select('*, empresas(*)')
    .eq('id', user.id)
    .single()

  return data
}

// ─── CADASTRO DE NOVA EMPRESA + USUÁRIO ADMIN ────────────
export async function cadastrarEmpresa(dados: {
  email: string
  senha: string
  nome_usuario: string
  cnpj: string
  razao_social: string
  cnae?: string
  grau_risco?: number
}) {
  // 1. Cria o usuário no Supabase Auth
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: dados.email,
    password: dados.senha,
  })
  if (authErr || !authData.user) throw new Error(authErr?.message || 'Erro ao criar conta.')

  // 2. Cria a empresa
  const { data: empresa, error: empErr } = await supabase
    .from('empresas')
    .insert({
      cnpj: dados.cnpj,
      razao_social: dados.razao_social,
      cnae: dados.cnae,
      grau_risco: dados.grau_risco,
    })
    .select()
    .single()

  if (empErr || !empresa) throw new Error('Erro ao cadastrar empresa.')

  // 3. Cria o usuário admin vinculado à empresa
  const { error: uErr } = await supabase
    .from('usuarios')
    .insert({
      id: authData.user.id,
      empresa_id: empresa.id,
      nome: dados.nome_usuario,
      perfil: 'admin',
    })

  if (uErr) throw new Error('Erro ao vincular usuário à empresa.')
  return empresa
}

// ─── HOOK: monitorar mudança de sessão ───────────────────
export function onAuthChange(callback: (session: unknown) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}
