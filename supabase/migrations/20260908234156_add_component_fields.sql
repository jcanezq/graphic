-- Add independent fields for service components
ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS labor_quantity           NUMERIC(10,4) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS labor_unit_cost          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS labor_margin_percent     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS design_quantity          NUMERIC(10,4) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS design_unit_cost         NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS design_margin_percent    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS transport_quantity       NUMERIC(10,4) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS transport_unit_cost      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS transport_margin_percent NUMERIC(5,2);
