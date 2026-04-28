-- ============================================================
-- MIGRAÇÃO 09 — Tabela pcmso_programa
-- Execute no Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS pcmso_programa (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  funcao          TEXT NOT NULL,
  setor           TEXT,
  riscos          JSONB NOT NULL DEFAULT '[]',
  exames          JSONB NOT NULL DEFAULT '[]',
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pcmso_programa_empresa_funcao UNIQUE (empresa_id, funcao)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pcmso_programa_empresa ON pcmso_programa(empresa_id);

-- RLS
ALTER TABLE pcmso_programa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios podem ver pcmso da empresa" ON pcmso_programa;
DROP POLICY IF EXISTS "usuarios podem inserir pcmso" ON pcmso_programa;
DROP POLICY IF EXISTS "usuarios podem editar pcmso" ON pcmso_programa;
DROP POLICY IF EXISTS "usuarios podem deletar pcmso" ON pcmso_programa;

CREATE POLICY "usuarios podem ver pcmso da empresa" ON pcmso_programa
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM usuario_empresas
      WHERE usuario_id = auth.uid() AND empresa_id = pcmso_programa.empresa_id
    ) OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND empresa_id = pcmso_programa.empresa_id
    )
  );

CREATE POLICY "usuarios podem inserir pcmso" ON pcmso_programa
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuario_empresas
      WHERE usuario_id = auth.uid() AND empresa_id = pcmso_programa.empresa_id
    ) OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND empresa_id = pcmso_programa.empresa_id
    )
  );

CREATE POLICY "usuarios podem editar pcmso" ON pcmso_programa
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM usuario_empresas
      WHERE usuario_id = auth.uid() AND empresa_id = pcmso_programa.empresa_id
    ) OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND empresa_id = pcmso_programa.empresa_id
    )
  );

CREATE POLICY "usuarios podem deletar pcmso" ON pcmso_programa
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM usuario_empresas
      WHERE usuario_id = auth.uid() AND empresa_id = pcmso_programa.empresa_id
    ) OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND empresa_id = pcmso_programa.empresa_id
    )
  );
