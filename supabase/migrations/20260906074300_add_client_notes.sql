-- Migración: Agregar campo de notas internas a la tabla de clientes
-- Fecha: 2026-09-06

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'notes'
  ) THEN
    ALTER TABLE clients ADD COLUMN notes TEXT;
  END IF;
END
$$;
