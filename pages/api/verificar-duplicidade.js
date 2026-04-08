// pages/api/verificar-duplicidade.js
// Verifica se já existe ASO duplicado antes de salvar

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // usa service key para bypass RLS
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' })

  const { funcionario_id, tipo_aso, data_exame, aso_id } = req.body

  if (!funcionario_id || !tipo_aso || !data_exame) {
    return res.status(400).json({ erro: 'Dados incompletos' })
  }

  try {
    // 1. Verificar duplicidade exata (mesmo mês, mesmo tipo, mesmo funcionário)
    const { data: resultado, error } = await supabase
      .rpc('verificar_aso_duplicado', {
        p_funcionario_id: funcionario_id,
        p_tipo_aso: tipo_aso,
        p_data_exame: data_exame,
        p_aso_id: aso_id || null,
      })

    if (error) throw error

    // 2. Verificar também transmissão já enviada para esse ASO
    if (resultado?.duplicado && resultado?.aso_id) {
      const { data: tx } = await supabase
        .from('transmissoes')
        .select('status, recibo, dt_envio')
        .eq('referencia_id', resultado.aso_id)
        .eq('evento', 'S-2220')
        .single()

      return res.status(200).json({
        ...resultado,
        transmissao: tx || null,
        jaTransmitido: tx?.status === 'enviado' || tx?.status === 'lote',
      })
    }

    return res.status(200).json(resultado)

  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao verificar: ' + err.message })
  }
}
