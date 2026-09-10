-- ============================================================
-- F3-T4 · Reconciliación de clients (H-11, H-05)
-- Las tres definiciones del repo divergían. Esta migración deja la tabla en
-- el estado que la app espera, sin depender de cuál script se ejecutó.
-- Idempotente.
-- ============================================================

-- deleted_at: existe en producción pero NINGÚN DDL del repo lo agregaba
-- (el CREATE TABLE IF NOT EXISTS de schema.sql:180 fue un no-op). Cierra H-05.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- notes: lo agrega 20260906074300_add_client_notes.sql; se re-declara por seguridad
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;

-- Índice de RUC: sólo existía en la versión de la raíz del repo
CREATE INDEX IF NOT EXISTS idx_clients_ruc ON public.clients (ruc) WHERE ruc IS NOT NULL;

-- Marcas de tiempo NOT NULL, como declaran dos de las tres definiciones.
-- Se rellenan primero los NULL para que el SET NOT NULL no falle.
UPDATE public.clients SET created_at = NOW() WHERE created_at IS NULL;
UPDATE public.clients SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;

DO $$
BEGIN
  ALTER TABLE public.clients ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE public.clients ALTER COLUMN updated_at SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'No se pudo fijar NOT NULL en las marcas de tiempo de clients: %', SQLERRM;
END $$;

-- Política duplicada: si se ejecutaron los dos scripts, la tabla quedó con DOS
-- políticas permisivas equivalentes. F1-T6 ya las elimina; esto lo asegura.
DROP POLICY IF EXISTS "Authenticated can manage clients" ON public.clients;
