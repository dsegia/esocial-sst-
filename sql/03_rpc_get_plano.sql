-- ============================================================
-- MIGRAÇÃO 03 — RPC para retornar status do plano da empresa
-- Execute no Supabase → SQL Editor
-- ============================================================

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
  SELECT plano, plano_expira_em, trial_inicio, max_funcionarios, stripe_customer_id
  INTO v_empresa
  FROM empresas
  WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  -- Calcula dias restantes de trial (14 dias a partir do início)
  v_dias_trial := GREATEST(0,
    14 - EXTRACT(DAY FROM (NOW() - v_empresa.trial_inicio))::INT
  );
  v_trial_ativo := (v_empresa.plano = 'trial' AND v_dias_trial > 0);

  -- Conta funcionários ativos
  SELECT COUNT(*) INTO v_qtd_funcionarios
  FROM funcionarios
  WHERE empresa_id = p_empresa_id AND ativo = true;

  RETURN jsonb_build_object(
    'plano',              v_empresa.plano,
    'plano_expira_em',    v_empresa.plano_expira_em,
    'trial_ativo',        v_trial_ativo,
    'trial_dias_restantes', v_dias_trial,
    'max_funcionarios',   v_empresa.max_funcionarios,
    'qtd_funcionarios',   v_qtd_funcionarios,
    'pode_adicionar',     (v_qtd_funcionarios < v_empresa.max_funcionarios),
    'tem_stripe',         (v_empresa.stripe_customer_id IS NOT NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_plano_empresa FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_plano_empresa TO authenticated;
