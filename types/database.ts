export type Database = {
  public: {
    Tables: {
      empresas: {
        Row: {
          id: string
          cnpj: string
          razao_social: string
          cnae: string | null
          grau_risco: number | null
          resp_tecnico: string | null
          resp_conselho: string | null
          resp_registro: string | null
          tipo_acesso: 'propria' | 'terceiro'
          ativo: boolean
          criado_em: string
          atualizado_em: string
          // Plano / SaaS
          plano: 'trial' | 'starter' | 'pro' | 'business' | 'enterprise' | 'cancelado'
          plano_expira_em: string | null
          trial_inicio: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          max_funcionarios: number
        }
        Insert: Omit<Database['public']['Tables']['empresas']['Row'], 'id' | 'criado_em' | 'atualizado_em'>
        Update: Partial<Database['public']['Tables']['empresas']['Insert']>
      }
      funcionarios: {
        Row: {
          id: string
          empresa_id: string
          nome: string
          cpf: string
          data_nasc: string
          data_adm: string
          matricula_esocial: string
          funcao: string | null
          cbo: string | null
          setor: string | null
          salario: number | null
          vinculo: string | null
          turno: string | null
          ativo: boolean
          criado_em: string
        }
        Insert: Omit<Database['public']['Tables']['funcionarios']['Row'], 'id' | 'criado_em'>
        Update: Partial<Database['public']['Tables']['funcionarios']['Insert']>
      }
      asos: {
        Row: {
          id: string
          funcionario_id: string
          empresa_id: string
          tipo_aso: 'admissional' | 'periodico' | 'retorno' | 'mudanca' | 'demissional' | 'monitoracao'
          data_exame: string
          prox_exame: string | null
          conclusao: 'apto' | 'inapto' | 'apto_restricao'
          medico_nome: string | null
          medico_crm: string | null
          exames: ExameItem[]
          riscos: string[]
          pdf_path: string | null
          criado_em: string
        }
        Insert: Omit<Database['public']['Tables']['asos']['Row'], 'id' | 'criado_em'>
        Update: Partial<Database['public']['Tables']['asos']['Insert']>
      }
      ltcats: {
        Row: {
          id: string
          empresa_id: string
          data_emissao: string
          data_vigencia: string
          prox_revisao: string | null
          resp_nome: string
          resp_conselho: string | null
          resp_registro: string | null
          ghes: GHE[]
          pdf_path: string | null
          ativo: boolean
          criado_em: string
        }
        Insert: Omit<Database['public']['Tables']['ltcats']['Row'], 'id' | 'criado_em'>
        Update: Partial<Database['public']['Tables']['ltcats']['Insert']>
      }
      cats: {
        Row: {
          id: string
          funcionario_id: string
          empresa_id: string
          tipo_cat: 'tipico' | 'trajeto' | 'doenca'
          dt_acidente: string
          hora_acidente: string | null
          cid: string
          natureza_lesao: string | null
          parte_corpo: string | null
          agente_causador: string | null
          descricao: string | null
          houve_morte: boolean
          dias_afastamento: number | null
          atendimento: AtendimentoCAT
          testemunhas: Testemunha[]
          criado_em: string
        }
        Insert: Omit<Database['public']['Tables']['cats']['Row'], 'id' | 'criado_em'>
        Update: Partial<Database['public']['Tables']['cats']['Insert']>
      }
      transmissoes: {
        Row: {
          id: string
          empresa_id: string
          funcionario_id: string | null
          evento: 'S-2210' | 'S-2220' | 'S-2240'
          referencia_id: string | null
          referencia_tipo: 'aso' | 'cat' | 'ltcat' | null
          status: 'pendente' | 'enviado' | 'rejeitado' | 'lote'
          recibo: string | null
          xml_path: string | null
          resposta_govbr: Record<string, unknown> | null
          erro_codigo: string | null
          erro_descricao: string | null
          tentativas: number
          lote_id: string | null
          ambiente: string | null
          dt_envio: string | null
          criado_em: string
        }
        Insert: Omit<Database['public']['Tables']['transmissoes']['Row'], 'id' | 'criado_em'>
        Update: Partial<Database['public']['Tables']['transmissoes']['Insert']>
      }
      usuarios: {
        Row: {
          id: string
          empresa_id: string
          nome: string
          perfil: 'admin' | 'operador' | 'visualizador'
          criado_em: string
        }
        Insert: Omit<Database['public']['Tables']['usuarios']['Row'], 'criado_em'>
        Update: Partial<Database['public']['Tables']['usuarios']['Insert']>
      }
    }
  }
}

// Tipos auxiliares
export type ExameItem = { nome: string; resultado: 'Normal' | 'Alterado' | 'Pendente' }
export type GHE = {
  id: number
  nome: string
  setor: string
  qtd_trabalhadores: number
  aposentadoria_especial: boolean
  agentes: AgenteRisco[]
  epc: EPC[]
  epi: EPI[]
}
export type AgenteRisco = { tipo: 'fis' | 'qui' | 'bio' | 'erg'; nome: string; valor: string; limite: string; supera_lt: boolean }
export type EPC = { nome: string; eficaz: boolean }
export type EPI = { nome: string; ca: string; eficaz: boolean }
export type AtendimentoCAT = { unidade?: string; cnpj?: string; data?: string; hora?: string; tipo?: string; medico?: string; crm?: string; obs?: string }
export type Testemunha = { nome: string; cpf: string }

// Tipos de retorno frequentes
export type Funcionario = Database['public']['Tables']['funcionarios']['Row']
export type ASO = Database['public']['Tables']['asos']['Row']
export type LTCAT = Database['public']['Tables']['ltcats']['Row']
export type CAT = Database['public']['Tables']['cats']['Row']
export type Transmissao = Database['public']['Tables']['transmissoes']['Row']
export type Empresa = Database['public']['Tables']['empresas']['Row']

// Plano / assinatura
export type TipoPlano = 'trial' | 'micro' | 'starter' | 'pro' | 'professional' | 'business' | 'enterprise' | 'cancelado'
export type PlanoStatus = {
  plano: TipoPlano
  plano_expira_em: string | null
  trial_ativo: boolean
  trial_dias_restantes: number
  max_funcionarios: number
  qtd_funcionarios: number
  pode_adicionar: boolean
  tem_stripe: boolean
  creditos_restantes?: number
  creditos_incluidos?: number
}

export const PLANOS: Record<string, { label: string; preco: number; max: number; cor: string; envios?: number; excedente?: string }> = {
  trial:        { label: 'Trial',        preco: 0,   max: 50,     cor: '#9ca3af' },
  micro:        { label: 'Micro',        preco: 49,  max: 50,     cor: '#185FA5', envios: 50,  excedente: 'R$ 1,90/envio extra' },
  starter:      { label: 'Starter',      preco: 97,  max: 200,    cor: '#27500A', envios: 100, excedente: 'R$ 1,50/envio extra' },
  pro:          { label: 'Pro',          preco: 197, max: 1000,   cor: '#633806', envios: 400, excedente: 'R$ 1,20/envio extra' },
  professional: { label: 'Professional', preco: 97,  max: 200,    cor: '#27500A' },
  business:     { label: 'Business',     preco: 697, max: 1000,   cor: '#633806' },
  enterprise:   { label: 'Enterprise',   preco: 0,   max: 999999, cor: '#059669' },
  cancelado:    { label: 'Cancelado',    preco: 0,   max: 0,      cor: '#ef4444' },
}
