-- Deduz 1 crédito de forma atômica (sem race condition).
-- Retorna true se havia crédito e a dedução foi feita, false caso contrário.
CREATE OR REPLACE FUNCTION consumir_credito(p_empresa_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows int;
BEGIN
  UPDATE empresas
    SET creditos_restantes = creditos_restantes - 1
  WHERE id = p_empresa_id
    AND creditos_restantes > 0;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;
