-- 07_security_fixes.sql
-- Correções de segurança: get_plano_empresa restringida ao usuário autenticado

-- Recria get_plano_empresa com restrição: só retorna dados da empresa
-- se o usuário autenticado (auth.uid()) pertence a ela via usuario_empresas.
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
  -- Garante que o chamador tem acesso à empresa
  IF NOT EXISTS (
    SELECT 1 FROM usuario_empresas
    WHERE usuario_id = auth.uid() AND empresa_id = p_empresa_id
  ) AND NOT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado a esta empresa';
  END IF;

  SELECT plano, plano_expira_em, trial_inicio, max_funcionarios, stripe_customer_id
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
    'tem_stripe',            (v_empresa.stripe_customer_id IS NOT NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_plano_empresa FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_plano_empresa TO authenticated;
