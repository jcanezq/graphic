-- Migration: Transactional update of quotation items
-- This function replaces the dangerous client-side DELETE-then-INSERT pattern
-- with a single atomic operation that won't lose items if the insert fails.
-- Execute in: Supabase Dashboard → SQL Editor

CREATE OR REPLACE FUNCTION replace_quotation_items(
  p_quotation_id UUID,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Step 1: Delete existing items (within this transaction)
  DELETE FROM quotation_items WHERE quotation_id = p_quotation_id;

  -- Step 2: Insert new items (if any)
  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO quotation_items (
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

  -- If either step fails, the entire transaction rolls back automatically
END;
$$;
