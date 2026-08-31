-- Función RPC para generar numeración segura (sin race condition)
-- Ejecutar en SQL Editor de Supabase
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_next INT;
  v_year INT;
  v_number TEXT;
BEGIN
  -- Lock the row to prevent concurrent reads
  SELECT quotation_prefix, quotation_next_number
  INTO v_prefix, v_next
  FROM company_settings
  LIMIT 1
  FOR UPDATE;

  IF v_prefix IS NULL THEN
    v_prefix := 'COT';
    v_next := 1;
  END IF;

  v_year := EXTRACT(YEAR FROM NOW());
  v_number := v_prefix || '-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');

  -- Atomically increment
  UPDATE company_settings
  SET quotation_next_number = v_next + 1;

  RETURN v_number;
END;
$$;
