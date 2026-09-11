-- Migration: Standardize columns across cost sections

-- 1. Add `unit` to product_labor
ALTER TABLE public.product_labor 
ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'hora';

-- 2. Add columns to product_indirect_costs
ALTER TABLE public.product_indirect_costs 
ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'global',
ADD COLUMN IF NOT EXISTS quantity NUMERIC NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC NOT NULL DEFAULT 0;

-- 3. Backfill unit_cost with the existing cost so records don't break
UPDATE public.product_indirect_costs 
SET unit_cost = cost 
WHERE unit_cost = 0 AND cost > 0;
