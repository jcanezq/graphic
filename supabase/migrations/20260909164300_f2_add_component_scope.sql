-- FASE 2 · Regla de escalado persistida por fila de cotización.
--   'unit'  → la cantidad del componente se multiplica por la cantidad del ítem
--   'order' → cargo fijo por pedido
--
-- CRÍTICO: todas las filas EXISTENTES se estampan como 'order', porque es
-- exactamente lo que hacía el código anterior (calcItemSubtotal(1, ...)).
-- Así ninguna cotización histórica cambia de monto. El DEFAULT también es
-- 'order' a propósito: si un camino de guardado se olvidara de mandar el
-- scope, el comportamiento degradado es el viejo, no un precio inflado.
ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS labor_scope     TEXT NOT NULL DEFAULT 'order' CHECK (labor_scope     IN ('unit','order')),
  ADD COLUMN IF NOT EXISTS design_scope    TEXT NOT NULL DEFAULT 'order' CHECK (design_scope    IN ('unit','order')),
  ADD COLUMN IF NOT EXISTS transport_scope TEXT NOT NULL DEFAULT 'order' CHECK (transport_scope IN ('unit','order'));

-- Backfill de las 9 columnas de componente que nunca se escribieron (C-2),
-- reconstruidas desde las columnas heredadas que SÍ se persistieron.
-- Con scope='order' y quantity=1 esto reproduce el subtotal ya almacenado.
UPDATE quotation_items SET
  labor_quantity           = COALESCE(labor_quantity, 1),
  labor_unit_cost          = COALESCE(labor_unit_cost, labor_cost, 0),
  labor_margin_percent     = COALESCE(labor_margin_percent, margin_percent),
  design_quantity          = COALESCE(design_quantity, 1),
  design_unit_cost         = COALESCE(design_unit_cost, design_cost, 0),
  design_margin_percent    = COALESCE(design_margin_percent, margin_percent),
  transport_quantity       = COALESCE(transport_quantity, 1),
  transport_unit_cost      = COALESCE(transport_unit_cost, transport_cost, 0),
  transport_margin_percent = COALESCE(transport_margin_percent, margin_percent)
WHERE labor_unit_cost IS NULL
   OR design_unit_cost IS NULL
   OR transport_unit_cost IS NULL;
