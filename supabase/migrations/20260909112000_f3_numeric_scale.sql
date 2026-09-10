-- ============================================================
-- F3-T11 · Escala explícita en las columnas de componentes (H-14)
-- ⚠ ALTER COLUMN TYPE con escala REDONDEA los valores existentes.
-- Idempotente (el ALTER a un tipo ya vigente es un no-op barato).
-- ============================================================

ALTER TABLE public.quotation_items
  ALTER COLUMN labor_quantity           TYPE NUMERIC(10,4),
  ALTER COLUMN labor_unit_cost          TYPE NUMERIC(12,2),
  ALTER COLUMN labor_margin_percent     TYPE NUMERIC(5,2),
  ALTER COLUMN design_quantity          TYPE NUMERIC(10,4),
  ALTER COLUMN design_unit_cost         TYPE NUMERIC(12,2),
  ALTER COLUMN design_margin_percent    TYPE NUMERIC(5,2),
  ALTER COLUMN transport_quantity       TYPE NUMERIC(10,4),
  ALTER COLUMN transport_unit_cost      TYPE NUMERIC(12,2),
  ALTER COLUMN transport_margin_percent TYPE NUMERIC(5,2),
  -- Unifica con la convención (12,2) del resto de los importes
  ALTER COLUMN transport_cost           TYPE NUMERIC(12,2);
