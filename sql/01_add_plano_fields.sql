-- ============================================================
-- MIGRAÇÃO 01 — Campos de plano/assinatura na tabela empresas
-- Execute no Supabase → SQL Editor
-- ============================================================

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'trial'
    CHECK (plano IN ('trial', 'starter', 'pro', 'business', 'enterprise', 'cancelado')),
  ADD COLUMN IF NOT EXISTS plano_expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_inicio TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS max_funcionarios INTEGER NOT NULL DEFAULT 50;

-- Empresas existentes: migrar para plano trial com início agora
UPDATE empresas
SET trial_inicio = NOW(),
    plano = 'trial',
    max_funcionarios = 50
WHERE plano = 'trial' AND trial_inicio IS NULL;
