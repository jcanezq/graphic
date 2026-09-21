-- ============================================================
-- SUBC-T3 · replace_quotation_items reescribe la receta que su DELETE se lleva
--
-- EL DEFECTO. La función borra los ítems de la cotización y los reinserta.
-- `quotation_item_components.quotation_item_id` es ON DELETE CASCADE, así que
-- ese DELETE se lleva TAMBIÉN la receta — y la lista de inserción no escribía
-- un solo subcomponente. Resultado: una cotización nace con su receta bien
-- guardada y, en cuanto alguien la abre en el panel y aprieta Guardar aunque no
-- cambie nada, la receta desaparece. El ítem cae al motor legado
-- (has_labor/has_design/has_transport), el desglose impreso pasa de seis filas
-- a dos, y el interruptor `is_included` muere con ella: un subcomponente que el
-- cliente había destildado VUELVE A COBRARSE. Una cotización correcta se
-- corrompía sola con una operación de rutina.
--
-- POR QUÉ ACÁ Y NO EN LA RUTA DE GUARDADO. Desde el navegador no hay
-- transacción: serían dos viajes, y entre uno y otro existiría una cotización
-- con ítems y sin receta. En esa ventana el PDF y el Excel imprimen legado. El
-- cuerpo de una función plpgsql corre dentro de la transacción de quien la
-- llama, así que acá las dos escrituras son una sola cosa: o entran las dos o
-- no entra ninguna.
--
-- La receta viaja anidada en cada elemento de `p_items`, en la clave
-- `components`. Un payload viejo sin esa clave se comporta como antes.
--
-- Se conserva TODO lo endurecido en 20260915170000: SECURITY INVOKER,
-- search_path fijo, validación de p_items, guarda de propiedad y el recálculo
-- transaccional de la cabecera. Idempotente (CREATE OR REPLACE).
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

  -- Cada receta se reencuentra con SU ítem por `sort_order`. Si viniera
  -- repetido, la asociación sería ambigua y el JOIN de abajo duplicaría filas
  -- en silencio. Se corta acá, ruidosamente, antes de tocar nada.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS elem
    GROUP BY (elem->>'sort_order')::INT
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'p_items trae sort_order repetidos: la receta no se puede asociar a su ítem'
      USING ERRCODE = '22023';
  END IF;

  -- La cascada de quotation_item_components se lleva la receta con los ítems.
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

    -- La receta, en la MISMA transacción que los ítems de arriba. Es una
    -- fotocopia: los valores salen del payload, no del catálogo, porque una
    -- cotización guardada no puede cambiar de precio cuando cambia el catálogo.
    INSERT INTO public.quotation_item_components (
      quotation_item_id, sort_order, category, source_kind, label, unit,
      quantity, unit_cost, margin_percent, scope, is_included
    )
    SELECT
      qi.id,
      COALESCE((c.comp->>'sort_order')::INT, (c.ord - 1)::INT),
      c.comp->>'category',
      NULLIF(c.comp->>'source_kind', ''),
      c.comp->>'label',
      NULLIF(c.comp->>'unit', ''),
      COALESCE((c.comp->>'quantity')::NUMERIC, 1),
      COALESCE((c.comp->>'unit_cost')::NUMERIC, 0),
      COALESCE((c.comp->>'margin_percent')::NUMERIC, 0),
      COALESCE(NULLIF(c.comp->>'scope', ''), 'unit'),
      COALESCE((c.comp->>'is_included')::BOOLEAN, TRUE)
    FROM jsonb_array_elements(p_items) AS elem
    JOIN public.quotation_items qi
      ON qi.quotation_id = p_quotation_id
     AND qi.sort_order   = (elem->>'sort_order')::INT
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(elem->'components') = 'array'
           THEN elem->'components'
           ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS c(comp, ord);
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

-- El panel escribe con la sesión del usuario (SECURITY INVOKER), y hasta ahora
-- `quotation_item_components` sólo tenía GRANT SELECT: sin esto, la inserción
-- de arriba falla por falta de privilegio aunque la política de RLS la permita.
-- Los privilegios no son la autorización: el RLS sigue mandando, y su política
-- de escritura es sólo de administrador (`qic_admin_all`). El cliente conserva
-- únicamente la lectura de lo suyo. El borrado no necesita privilegio acá: lo
-- hace la cascada de la FK.
REVOKE ALL ON TABLE public.quotation_item_components FROM anon;
GRANT INSERT, UPDATE, DELETE ON TABLE public.quotation_item_components TO authenticated;
