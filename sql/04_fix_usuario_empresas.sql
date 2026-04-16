-- ============================================================
-- MIGRAÇÃO 04 — Corrige tabela usuario_empresas
-- Execute no Supabase → SQL Editor
-- ============================================================

-- Adiciona coluna tipo_acesso se não existir
ALTER TABLE usuario_empresas
  ADD COLUMN IF NOT EXISTS tipo_acesso TEXT NOT NULL DEFAULT 'empresa'
    CHECK (tipo_acesso IN ('empresa', 'escritorio', 'admin'));

-- Recria a RPC criar_conta sem bloqueio de CNPJ duplicado no trial
-- (trial aceita CNPJ fake / qualquer CNPJ de 14 dígitos)
CREATE OR REPLACE FUNCTION criar_conta(
  p_razao_social  TEXT,
  p_cnpj          TEXT,
  p_user_id       UUID,
  p_user_nome     TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  -- 1. Cria a empresa em trial
  INSERT INTO empresas (
    razao_social, cnpj, tipo_acesso, ativo,
    plano, trial_inicio, max_funcionarios
  )
  VALUES (
    p_razao_social, p_cnpj, 'propria', true,
    'trial', NOW(), 50
  )
  RETURNING id INTO v_empresa_id;

  -- 2. Cria o perfil do usuário
  INSERT INTO usuarios (id, empresa_id, nome, perfil)
  VALUES (p_user_id, v_empresa_id, p_user_nome, 'admin')
  ON CONFLICT (id) DO UPDATE SET empresa_id = v_empresa_id, perfil = 'admin';

  -- 3. Vincula na tabela usuario_empresas (multi-empresa)
  INSERT INTO usuario_empresas (usuario_id, empresa_id, perfil, tipo_acesso)
  VALUES (p_user_id, v_empresa_id, 'admin', 'empresa')
  ON CONFLICT (usuario_id, empresa_id) DO NOTHING;

  RETURN jsonb_build_object(
    'empresa_id', v_empresa_id,
    'plano', 'trial',
    'trial_dias_restantes', 14
  );
END;
$$;

REVOKE ALL ON FUNCTION criar_conta FROM PUBLIC;
GRANT EXECUTE ON FUNCTION criar_conta TO authenticated;
