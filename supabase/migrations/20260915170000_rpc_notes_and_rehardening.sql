-- ============================================================
-- replace_quotation_items — restaura el endurecimiento y agrega notes
--
-- 20260909171100_f2_update_rpc.sql hizo CREATE OR REPLACE sobre la versión
-- endurecida por 20260909101000_f1_rpc_hardening.sql. CREATE OR REPLACE
-- reemplaza la definición COMPLETA, así que se perdieron en silencio:
--   SECURITY INVOKER, SET search_path, validación de p_items,
--   guarda de propiedad y el recálculo transaccional de la cabecera.
-- Lo que f2 sí aportó —las 3 columnas *_scope— se conserva acá.
-- Se agrega además quotation_items.notes (20260915140000), que la función
-- no copiaba: editar una cotización borraba las observaciones por ítem.
-- Idempotente (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.replace_quotation_items(
  p_quotation_id UUID,
  p_items        JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER                      -- respeta el RLS
SET search_path = public, pg_temp     -- cierra el secuestro de nombres
AS $$
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items debe ser un arreglo JSON (recibido: %)',
      COALESCE(jsonb_typeof(p_items), 'null')
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.quotations q
    WHERE q.id = p_quotation_id
      AND q.deleted_at IS NULL
      AND (public.is_admin() OR q.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Cotización % no encontrada o sin permisos', p_quotation_id
      USING ERRCODE = '42501';
  END IF;

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
      transport_quantity, transport_unit_cost, transport_margin_percent,
      labor_scope, design_scope, transport_scope,
      notes
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
      (elem->>'transport_margin_percent')::NUMERIC,
      COALESCE(elem->>'labor_scope', 'order'),
      COALESCE(elem->>'design_scope', 'order'),
      COALESCE(elem->>'transport_scope', 'order'),
      elem->>'notes'
    FROM jsonb_array_elements(p_items) AS elem;
  END IF;

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
