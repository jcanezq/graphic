-- ============================================================
-- F3-T10 · Triggers de updated_at (H-16)
-- Un UPDATE que no venga de los 5 sitios de la app dejaba updated_at
-- congelado en la fecha de creación. La garantía pasa a ser del motor.
-- Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','materials','quotations','clients','company_settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$I '
      'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- El trigger viejo de clients (de legacy/clients_table.sql:37) queda reemplazado.
DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;
