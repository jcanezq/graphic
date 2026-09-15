-- Observaciones por ítem de cotización.
-- Las escriben tanto el administrador como el cliente; viajan con la cotización.
-- Distinta de quotations.notes, que es la observación de la cotización entera.
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.quotation_items.notes IS
  'Observación libre de esta línea, escrita por el cliente o por el administrador.';
