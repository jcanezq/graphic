-- Migración: Agregar sistema de versionado de cotizaciones
-- Fecha: 2026-09-06
-- Agrega parent_id (referencia a la cotización original) y revision (letra A, B, C...)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotations' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE quotations ADD COLUMN parent_id UUID REFERENCES quotations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotations' AND column_name = 'revision'
  ) THEN
    ALTER TABLE quotations ADD COLUMN revision VARCHAR(2) DEFAULT NULL;
  END IF;
END
$$;

-- Índice para buscar revisiones de una cotización padre
CREATE INDEX IF NOT EXISTS idx_quotations_parent_id ON quotations(parent_id) WHERE parent_id IS NOT NULL;
