-- Aplicar SOLO si la verificación de F3-T8 demostró que la restricción no existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.quotations'::regclass AND contype='u'
      AND pg_get_constraintdef(oid) ILIKE '%(number)%'
  ) THEN
    ALTER TABLE public.quotations ADD CONSTRAINT quotations_number_key UNIQUE (number);
  END IF;
END $$;
