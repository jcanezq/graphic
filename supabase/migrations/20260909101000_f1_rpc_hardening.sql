-- ============================================================
-- F1-T5 · replace_quotation_items endurecida (H-01, H-15)
-- Cambios: SECURITY INVOKER (era DEFINER), search_path fijo,
--          guarda de propiedad, validación de p_items,
--          recálculo de los totales de la cabecera.
-- Idempotente (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.replace_quotation_items(
  p_quotation_id UUID,
  p_items        JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER                      -- (era SECURITY DEFINER: evitaba el RLS)
SET search_path = public, pg_temp     -- cierra el secuestro de nombres
AS $$
BEGIN
  -- (1) p_items debe ser un arreglo JSON. Antes, un objeto o NULL abortaba
  --     con un error opaco de jsonb_array_length.
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items debe ser un arreglo JSON (recibido: %)',
      COALESCE(jsonb_typeof(p_items), 'null')
      USING ERRCODE = '22023';
  END IF;

  -- (2) Guarda de propiedad. Redundante con el RLS bajo SECURITY INVOKER,
  --     y deliberadamente redundante: da un error explícito en vez de un
  --     DELETE de cero filas, y protege si alguien revierte a DEFINER.
  IF NOT EXISTS (
    SELECT 1 FROM public.quotations q
    WHERE q.id = p_quotation_id
      AND q.deleted_at IS NULL
      AND (public.is_admin() OR q.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Cotización % no encontrada o sin permisos', p_quotation_id
      USING ERRCODE = '42501';
  END IF;

  -- (3) Reemplazo transaccional de los ítems (comportamiento original)
  DELETE FROM public.quotation_items WHERE quotation_id = p_quotation_id;

  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO public.quotation_items (
      quotation_id, product_id, sort_order, product_code,
      product_name, product_description, unit,
      material_cost, labor_cost, indirect_cost, unit_cost,
      quantity, margin_percent, unit_price, subtotal,
      item_type, has_labor, has_design, design_cost,
      has_transport, transport_cost, client_design_url,
      labor_quantity, labor_unit_cost, labor_margin_percent,
      design_quantity, design_unit_cost, design_margin_percent,
      transport_quantity, transport_unit_cost, transport_margin_percent
    )
    SELECT
      p_quotation_id,
      NULLIF(elem->>'product_id', '')::UUID,
      (elem->>'sort_order')::INT,
      elem->>'product_code',
      elem->>'product_name',
      elem->>'product_description',
      elem->>'unit',
      (elem->>'material_cost')::NUMERIC,
      (elem->>'labor_cost')::NUMERIC,
      (elem->>'indirect_cost')::NUMERIC,
      (elem->>'unit_cost')::NUMERIC,
      (elem->>'quantity')::NUMERIC,
      (elem->>'margin_percent')::NUMERIC,
      (elem->>'unit_price')::NUMERIC,
      (elem->>'subtotal')::NUMERIC,
      elem->>'item_type',
      COALESCE((elem->>'has_labor')::BOOLEAN, true),
      COALESCE((elem->>'has_design')::BOOLEAN, true),
      COALESCE((elem->>'design_cost')::NUMERIC, 0),
      COALESCE((elem->>'has_transport')::BOOLEAN, true),
      COALESCE((elem->>'transport_cost')::NUMERIC, 0),
      elem->>'client_design_url',
      (elem->>'labor_quantity')::NUMERIC,
      (elem->>'labor_unit_cost')::NUMERIC,
      (elem->>'labor_margin_percent')::NUMERIC,
      (elem->>'design_quantity')::NUMERIC,
      (elem->>'design_unit_cost')::NUMERIC,
      (elem->>'design_margin_percent')::NUMERIC,
      (elem->>'transport_quantity')::NUMERIC,
      (elem->>'transport_unit_cost')::NUMERIC,
      (elem->>'transport_margin_percent')::NUMERIC
    FROM jsonb_array_elements(p_items) AS elem;
  END IF;

  -- (4) Los totales de la cabecera se recalculan acá, en la MISMA transacción.
  --     Antes vivían en el cliente (cotizaciones/[id]/page.tsx:182), en una
  --     llamada separada: si una fallaba, cabecera e ítems quedaban descuadrados.
  UPDATE public.quotations q SET
    subtotal   = COALESCE(t.s, 0),
    igv        = ROUND(COALESCE(t.s, 0) * q.igv_rate, 2),
    total      = COALESCE(t.s, 0) + ROUND(COALESCE(t.s, 0) * q.igv_rate, 2),
    updated_at = NOW()
  FROM (
    SELECT SUM(subtotal) AS s FROM public.quotation_items
    WHERE quotation_id = p_quotation_id
  ) t
  WHERE q.id = p_quotation_id;
END;
$$;
