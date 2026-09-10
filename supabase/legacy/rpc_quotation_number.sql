-- Función RPC para generar numeración segura (sin race condition)
-- Ejecutar en SQL Editor de Supabase
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_prefix TEXT;
  v_next INT;
  v_year INT;
  v_number TEXT;
BEGIN
  -- Lock the row to prevent concurrent reads
  SELECT id, quotation_prefix, quotation_next_number
  INTO v_id, v_prefix, v_next
  FROM company_settings
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    INSERT INTO company_settings (company_name, default_margin, igv_rate, quotation_prefix, quotation_next_number)
    VALUES ('Mi Empresa Gráfica', 30.00, 0.1800, 'COT', 1)
    RETURNING id, quotation_prefix, quotation_next_number
    INTO v_id, v_prefix, v_next;
  END IF;

  IF v_prefix IS NULL THEN
    v_prefix := 'COT';
  END IF;
  IF v_next IS NULL THEN
    v_next := 1;
  END IF;

  v_year := EXTRACT(YEAR FROM NOW());
  v_number := v_prefix || '-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');

  -- Atomically increment (WHERE clause required by Postgres/safeupdate extension)
  UPDATE company_settings
  SET quotation_next_number = v_next + 1
  WHERE id = v_id;

  RETURN v_number;
END;
$$;

