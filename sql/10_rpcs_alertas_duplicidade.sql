-- ============================================================
-- MIGRAÇÃO 10 — RPCs get_alertas_vencimento e verificar_aso_duplicado
-- Execute no Supabase → SQL Editor
-- ============================================================

-- ── get_alertas_vencimento ────────────────────────────────
-- Retorna alertas de ASOs vencidos ou a vencer nos próximos 60 dias
CREATE OR REPLACE FUNCTION get_alertas_vencimento(p_empresa_id UUID)
RETURNS TABLE (
  funcionario_id  UUID,
  nome            TEXT,
  matricula       TEXT,
  setor           TEXT,
  tipo_alerta     TEXT,
  data_venc       DATE,
  dias_restantes  INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM usuario_empresas
    WHERE usuario_id = auth.uid() AND empresa_id = p_empresa_id
  ) AND NOT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (f.id)
    f.id                                                   AS funcionario_id,
    f.nome                                                 AS nome,
    f.matricula_esocial                                    AS matricula,
    f.setor                                                AS setor,
    CASE
      WHEN a.prox_exame < CURRENT_DATE          THEN 'vencido'
      WHEN a.prox_exame <= CURRENT_DATE + 30    THEN 'vence_30'
      ELSE                                           'vence_60'
    END                                                    AS tipo_alerta,
    a.prox_exame                                           AS data_venc,
    (a.prox_exame - CURRENT_DATE)::INTEGER                 AS dias_restantes
  FROM funcionarios f
  JOIN asos a ON a.funcionario_id = f.id
  WHERE f.empresa_id = p_empresa_id
    AND f.ativo = true
    AND a.prox_exame IS NOT NULL
    AND a.prox_exame <= CURRENT_DATE + INTERVAL '60 days'
  ORDER BY f.id, a.data_exame DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_alertas_vencimento(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_alertas_vencimento(UUID) TO authenticated;

-- ── verificar_aso_duplicado ───────────────────────────────
-- Verifica se já existe ASO do mesmo tipo no mesmo dia para o funcionário
CREATE OR REPLACE FUNCTION verificar_aso_duplicado(
  p_funcionario_id  UUID,
  p_tipo_aso        TEXT,
  p_data_exame      DATE,
  p_aso_id          UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_aso_id UUID;
  v_empresa_id UUID;
BEGIN
  -- Valida acesso: usuário deve pertencer à empresa do funcionário
  SELECT empresa_id INTO v_empresa_id FROM funcionarios WHERE id = p_funcionario_id;

  IF NOT EXISTS (
    SELECT 1 FROM usuario_empresas
    WHERE usuario_id = auth.uid() AND empresa_id = v_empresa_id
  ) AND NOT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  SELECT id INTO v_aso_id
  FROM asos
  WHERE funcionario_id = p_funcionario_id
    AND tipo_aso = p_tipo_aso
    AND data_exame = p_data_exame
    AND (p_aso_id IS NULL OR id <> p_aso_id)
  LIMIT 1;

  IF v_aso_id IS NOT NULL THEN
    RETURN jsonb_build_object('duplicado', true, 'aso_id', v_aso_id);
  END IF;

  RETURN jsonb_build_object('duplicado', false, 'aso_id', NULL);
END;
$$;

REVOKE ALL ON FUNCTION verificar_aso_duplicado(UUID, TEXT, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verificar_aso_duplicado(UUID, TEXT, DATE, UUID) TO authenticated;
