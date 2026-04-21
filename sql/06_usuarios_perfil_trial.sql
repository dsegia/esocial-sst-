-- ============================================================
-- MIGRAÇÃO 06 — Perfil de usuários + trial_ends_at automático
-- Execute no Supabase → SQL Editor
-- ============================================================

-- 1. Coluna perfil em usuarios (admin / operador / visualizador)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS perfil TEXT NOT NULL DEFAULT 'operador'
    CHECK (perfil IN ('admin', 'operador', 'visualizador'));

-- 2. Coluna email em usuarios (alguns registros podem não ter)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. Garantir que o fundador da empresa fica como admin
--    (executa apenas se a coluna existia com valor NULL)
UPDATE usuarios u
SET perfil = 'admin'
FROM empresas e
WHERE u.empresa_id = e.id
  AND u.perfil = 'operador'
  AND u.criado_em = (
    SELECT MIN(u2.criado_em)
    FROM usuarios u2
    WHERE u2.empresa_id = e.id
  );

-- 4. trial_ends_at computado (coluna gerada)
--    (se trial_inicio existir na tabela empresas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'empresas' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE empresas
      ADD COLUMN trial_ends_at TIMESTAMPTZ GENERATED ALWAYS AS
        (trial_inicio + INTERVAL '14 days') STORED;
  END IF;
END $$;

-- 5. Atualiza RPC get_plano_empresa para usar trial_ends_at
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
    14 - EXTRACT(DAY FROM (NOW() - COALESCE(v_empresa.trial_inicio, NOW())))::INT
  );
  v_trial_ativo := (v_empresa.plano = 'trial' AND v_dias_trial > 0);

  -- Conta funcionários ativos
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

-- 6. Trigger: ao criar nova empresa, garantir trial_inicio preenchido
CREATE OR REPLACE FUNCTION set_trial_inicio()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.trial_inicio IS NULL THEN
    NEW.trial_inicio := NOW();
  END IF;
  IF NEW.plano IS NULL THEN
    NEW.plano := 'trial';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_trial_inicio ON empresas;
CREATE TRIGGER trg_set_trial_inicio
  BEFORE INSERT ON empresas
  FOR EACH ROW EXECUTE FUNCTION set_trial_inicio();
