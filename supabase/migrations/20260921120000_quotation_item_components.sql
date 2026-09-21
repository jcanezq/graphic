-- ============================================================
-- SUBC-T2 · Los subcomponentes de cada línea de cotización.
--
-- Hasta ahora la cotización guardaba TOTALES (material_cost, labor_cost,
-- indirect_cost) y tres componentes con columnas dedicadas. El detalle del
-- catálogo se perdía al cotizar, así que no había nada que marcar ni editar.
--
-- Se COPIA, no se referencia: una cotización es una foto. Si mañana sube el
-- precio de un material, la cotización de la semana pasada no puede cambiar.
-- Es la misma regla que ya rige product_name y unit_cost en quotation_items.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quotation_item_components (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_item_id UUID NOT NULL REFERENCES public.quotation_items(id) ON DELETE CASCADE,
  sort_order        INT  NOT NULL DEFAULT 0,

  -- Las CUATRO categorías del modelo de costos (ver ARQUITECTURA.md §4.3).
  category          TEXT NOT NULL CHECK (category IN ('material','labor','production','other')),

  -- `design` y `transport` siguen siendo distinguibles porque de ellos dependen
  -- el pedido de arte al cliente y el alcance por pedido. Viven DENTRO de
  -- production y other respectivamente, como marca `product_indirect_costs.kind`.
  source_kind       TEXT CHECK (source_kind IN ('design','transport')),

  label             TEXT NOT NULL,
  unit              TEXT,
  quantity          NUMERIC NOT NULL DEFAULT 1,
  unit_cost         NUMERIC NOT NULL DEFAULT 0,
  margin_percent    NUMERIC NOT NULL DEFAULT 0,

  -- 'unit' multiplica por la cantidad del ítem; 'order' se cobra una vez.
  scope             TEXT NOT NULL DEFAULT 'unit' CHECK (scope IN ('unit','order')),

  -- EL INTERRUPTOR. Es lo que pidió el dueño: todos opcionales.
  is_included       BOOLEAN NOT NULL DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qic_item_idx
  ON public.quotation_item_components (quotation_item_id, sort_order);

ALTER TABLE public.quotation_item_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qic_admin_all"        ON public.quotation_item_components;
DROP POLICY IF EXISTS "qic_client_own_read"  ON public.quotation_item_components;

CREATE POLICY "qic_admin_all" ON public.quotation_item_components
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- El cliente lee los subcomponentes de SUS cotizaciones. La pertenencia se
-- resuelve subiendo por el ítem hasta la cotización: es la misma cadena que ya
-- usa quotation_items.
CREATE POLICY "qic_client_own_read" ON public.quotation_item_components
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotation_items qi
    JOIN public.quotations q ON q.id = qi.quotation_id
    WHERE qi.id = quotation_item_id AND q.user_id = auth.uid()
  ));

GRANT SELECT ON TABLE public.quotation_item_components TO authenticated;
