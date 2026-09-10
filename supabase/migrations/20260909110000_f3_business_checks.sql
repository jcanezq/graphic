-- ============================================================
-- F3-T6 · CHECK de dominio de negocio (H-09)
-- Se agregan como NOT VALID: NO rechazan filas históricas, sólo las nuevas.
-- La validación de lo histórico es un paso aparte y explícito.
-- Idempotente.
-- ============================================================

DO $$
BEGIN
  -- quotation_items
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='qi_quantity_pos') THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT qi_quantity_pos CHECK (quantity > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='qi_unit_price_nonneg') THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT qi_unit_price_nonneg CHECK (unit_price >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='qi_subtotal_nonneg') THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT qi_subtotal_nonneg CHECK (subtotal >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='qi_costs_nonneg') THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT qi_costs_nonneg CHECK (
        material_cost >= 0 AND labor_cost >= 0
        AND indirect_cost >= 0 AND unit_cost >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='qi_margin_range') THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT qi_margin_range
      CHECK (margin_percent BETWEEN -100 AND 1000) NOT VALID;
  END IF;

  -- quotations
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='q_amounts_nonneg') THEN
    ALTER TABLE public.quotations
      ADD CONSTRAINT q_amounts_nonneg
      CHECK (subtotal >= 0 AND igv >= 0 AND total >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='q_igv_rate_range') THEN
    ALTER TABLE public.quotations
      ADD CONSTRAINT q_igv_rate_range CHECK (igv_rate >= 0 AND igv_rate <= 1) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='q_validity_pos') THEN
    ALTER TABLE public.quotations
      ADD CONSTRAINT q_validity_pos CHECK (validity_days > 0) NOT VALID;
  END IF;

  -- products / materials / product_labor
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_type_valid') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_type_valid
      CHECK (type IN ('Producto','Servicio','Material')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='materials_cost_nonneg') THEN
    ALTER TABLE public.materials
      ADD CONSTRAINT materials_cost_nonneg CHECK (cost >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pl_hours_pos') THEN
    ALTER TABLE public.product_labor
      ADD CONSTRAINT pl_hours_pos CHECK (hours > 0 AND hourly_rate >= 0) NOT VALID;
  END IF;
END $$;
