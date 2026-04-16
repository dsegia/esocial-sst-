-- ============================================================
-- MIGRAÇÃO 05 — Coluna bloqueado na tabela empresas
-- Execute no Supabase → SQL Editor
-- ============================================================

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN NOT NULL DEFAULT false;

-- Habilita Realtime na tabela empresas (para o admin ver cadastros em tempo real)
-- Certifique-se que a tabela está na publication supabase_realtime:
ALTER PUBLICATION supabase_realtime ADD TABLE empresas;
