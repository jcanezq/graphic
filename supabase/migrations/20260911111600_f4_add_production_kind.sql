-- Alterar la tabla para permitir 'production' en la columna kind
ALTER TABLE public.product_indirect_costs 
DROP CONSTRAINT IF EXISTS product_indirect_costs_kind_check;

ALTER TABLE public.product_indirect_costs 
ADD CONSTRAINT product_indirect_costs_kind_check 
CHECK (kind IN ('design', 'transport', 'production', 'other'));
