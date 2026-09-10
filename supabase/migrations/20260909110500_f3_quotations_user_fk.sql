-- ============================================================
-- F3-T7 · Clave foránea de quotations.user_id (H-10, mitad de integridad)
-- ON DELETE RESTRICT: no se borra un usuario que tiene cotizaciones.
-- Es lo correcto para documentos comerciales: preferimos impedir el borrado
-- antes que perder la autoría de una cotización emitida.
-- Idempotente.
-- ============================================================

DO $$
DECLARE huerfanos INT;
BEGIN
  SELECT count(*) INTO huerfanos FROM public.quotations q
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = q.user_id);

  IF huerfanos > 0 THEN
    RAISE EXCEPTION
      'Hay % cotizaciones con user_id huérfano. Requiere decisión humana (F3-T7).', huerfanos;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='quotations_user_id_fkey') THEN
    ALTER TABLE public.quotations
      ADD CONSTRAINT quotations_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
  END IF;
END $$;
