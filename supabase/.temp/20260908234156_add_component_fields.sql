-- Add independent fields for service components
ALTER TABLE quotation_items
ADD COLUMN labor_quantity NUMERIC DEFAULT 1,
ADD COLUMN labor_unit_cost NUMERIC,
ADD COLUMN labor_margin_percent NUMERIC,
ADD COLUMN design_quantity NUMERIC DEFAULT 1,
ADD COLUMN design_unit_cost NUMERIC,
ADD COLUMN design_margin_percent NUMERIC,
ADD COLUMN transport_quantity NUMERIC DEFAULT 1,
ADD COLUMN transport_unit_cost NUMERIC,
ADD COLUMN transport_margin_percent NUMERIC;
