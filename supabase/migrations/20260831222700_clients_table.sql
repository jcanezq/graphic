-- Este script crea la tabla de clientes (usada en el CRM) si es que no se había creado antes.

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  ruc VARCHAR(11),
  address TEXT,
  phone VARCHAR(20),
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Política para que usuarios autenticados puedan leer y escribir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'auth_all_clients'
  ) THEN
    CREATE POLICY "auth_all_clients" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END
$$;
