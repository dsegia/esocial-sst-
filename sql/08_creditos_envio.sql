-- ============================================================
-- MIGRAÇÃO 08 — Créditos de envio por plano (modelo híbrido)
-- Execute no Supabase → SQL Editor
-- ============================================================

-- 1. Novas colunas na tabela empresas
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS creditos_restantes    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creditos_incluidos    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_metered_item_id TEXT;

-- 2. Atualiza constraint de plano para incluir 'micro'
DO $$
BEGIN
  ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_plano_check;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE empresas
  ADD CONSTRAINT empresas_plano_check
    CHECK (plano IN ('trial','micro','starter','pro','business','enterprise','cancelado'));

-- 3. Preenche créditos para empresas existentes
UPDATE empresas SET creditos_restantes = 10,   creditos_incluidos = 10   WHERE plano = 'trial'                      AND creditos_restantes = 0;
UPDATE empresas SET creditos_restantes = 30,   creditos_incluidos = 30   WHERE plano = 'micro'                      AND creditos_restantes = 0;
UPDATE empresas SET creditos_restantes = 100,  creditos_incluidos = 100  WHERE plano = 'starter'                    AND creditos_restantes = 0;
UPDATE empresas SET creditos_restantes = 400,  creditos_incluidos = 400  WHERE plano = 'pro'                        AND creditos_restantes = 0;
UPDATE empresas SET creditos_restantes = 9999, creditos_incluidos = 9999 WHERE plano IN ('business','enterprise')   AND creditos_restantes = 0;

-- 4. Atualiza RPC get_plano_empresa para expor créditos
CREATE OR REPLACE FUNCTION get_plano_empresa(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa RECORD;
  v_dias_trial INT;
  v_trial_ativo BOOLEAN;
  v_qtd_funcionarios INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM usuario_empresas
    WHERE usuario_id = auth.uid() AND empresa_id = p_empresa_id
  ) AND NOT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta empresa';
  END IF;

  SELECT plano, plano_expira_em, trial_inicio, max_funcionarios, stripe_customer_id,
         creditos_restantes, creditos_incluidos
  INTO v_empresa
  FROM empresas
  WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  v_dias_trial := GREATEST(0,
    14 - EXTRACT(DAY FROM (NOW() - COALESCE(v_empresa.trial_inicio, NOW())))::INT
  );
  v_trial_ativo := (v_empresa.plano = 'trial' AND v_dias_trial > 0);

  SELECT COUNT(*) INTO v_qtd_funcionarios
  FROM funcionarios
  WHERE empresa_id = p_empresa_id AND ativo = true;

  RETURN jsonb_build_object(
    'plano',                 v_empresa.plano,
    'plano_expira_em',       v_empresa.plano_expira_em,
    'trial_ativo',           v_trial_ativo,
    'trial_dias_restantes',  v_dias_trial,
    'max_funcionarios',      v_empresa.max_funcionarios,
    'qtd_funcionarios',      v_qtd_funcionarios,
    'pode_adicionar',        (v_qtd_funcionarios < v_empresa.max_funcionarios),
    'tem_stripe',            (v_empresa.stripe_customer_id IS NOT NULL),
    'creditos_restantes',    v_empresa.creditos_restantes,
    'creditos_incluidos',    v_empresa.creditos_incluidos
  );
END;
$$;

REVOKE ALL ON FUNCTION get_plano_empresa FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_plano_empresa TO authenticated;
