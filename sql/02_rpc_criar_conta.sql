-- ============================================================
-- MIGRAÇÃO 02 — RPC para self-service signup
-- Execute no Supabase → SQL Editor
-- ============================================================

-- Função chamada pelo /api/cadastro logo após criar o usuário no Auth
CREATE OR REPLACE FUNCTION criar_conta(
  p_razao_social  TEXT,
  p_cnpj          TEXT,
  p_user_id       UUID,
  p_user_nome     TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER   -- roda como superuser do schema
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  -- Bloqueia CNPJ duplicado
  IF EXISTS (SELECT 1 FROM empresas WHERE cnpj = p_cnpj) THEN
    RAISE EXCEPTION 'CNPJ já cadastrado no sistema.';
  END IF;

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
    'plano', 'trial'
  );
END;
$$;

-- Garante que apenas usuários autenticados chamem
REVOKE ALL ON FUNCTION criar_conta FROM PUBLIC;
GRANT EXECUTE ON FUNCTION criar_conta TO authenticated;
