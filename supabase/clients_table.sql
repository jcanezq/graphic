-- Tabla de clientes para autocompletar en cotizaciones
-- Ejecutar en SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  ruc TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_ruc ON clients (ruc);

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage clients"
  ON clients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger de updated_at
CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Rellenar desde cotizaciones existentes (sin duplicados)
INSERT INTO clients (name, ruc, address, phone, email)
SELECT DISTINCT ON (client_name)
  client_name,
  client_ruc,
  client_address,
  client_phone,
  client_email
FROM quotations
WHERE client_name IS NOT NULL
ON CONFLICT DO NOTHING;
