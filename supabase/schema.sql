-- ============================================================
-- CotiGrafix — Esquema de base de datos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) Configuración de empresa
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Mi Empresa',
  ruc VARCHAR(11),
  address TEXT,
  phone VARCHAR(20),
  email TEXT,
  logo_url TEXT,
  default_margin NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  igv_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1800,
  quotation_prefix VARCHAR(10) NOT NULL DEFAULT 'COT',
  quotation_next_number INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Categorías de productos
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#6366f1',
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Productos/Servicios
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'unidad',
  image_url TEXT,
  manual_unit_cost NUMERIC(12,2),
  default_margin NUMERIC(5,2) DEFAULT 30.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) Materiales/Insumos de un producto
CREATE TABLE IF NOT EXISTS product_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC(10,4) NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'unidad'
);

-- 5) Mano de obra de un producto
CREATE TABLE IF NOT EXISTS product_labor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  work_type TEXT NOT NULL,
  hours NUMERIC(6,2) NOT NULL DEFAULT 1,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- 6) Costos indirectos de un producto
CREATE TABLE IF NOT EXISTS product_indirect_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 7) Cotizaciones
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR(20) NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_ruc VARCHAR(11),
  client_address TEXT,
  client_phone VARCHAR(20),
  client_email TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  igv_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1800,
  igv NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  validity_days INT NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'borrador'
    CHECK (status IN ('borrador','enviada','aceptada','rechazada','vencida')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8) Ítems de cotización (snapshot del producto al momento de cotizar)
CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  product_code VARCHAR(20),
  product_name TEXT NOT NULL,
  product_description TEXT,
  unit TEXT NOT NULL DEFAULT 'unidad',
  material_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  labor_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  indirect_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity NUMERIC(10,4) NOT NULL DEFAULT 1,
  margin_percent NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('spanish', name));
CREATE INDEX IF NOT EXISTS idx_quotations_user ON quotations(user_id);
CREATE INDEX IF NOT EXISTS idx_quotations_number ON quotations(number);
CREATE INDEX IF NOT EXISTS idx_quotations_client ON quotations(client_name);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_indirect_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

-- Políticas: Usuarios autenticados tienen acceso completo
CREATE POLICY "auth_all_settings" ON company_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_categories" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_materials" ON product_materials FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_labor" ON product_labor FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_indirects" ON product_indirect_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_quotations" ON quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_items" ON quotation_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9) Clientes
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
CREATE POLICY "auth_all_clients" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Storage: bucket para imágenes de productos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_upload_images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "public_read_images" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'product-images');
CREATE POLICY "auth_delete_images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');
CREATE POLICY "auth_update_images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');

-- ============================================================
-- Seed: Categorías iniciales (basadas en carpeta galeria/GALERIA/)
-- ============================================================
INSERT INTO categories (name, slug, color, sort_order) VALUES
  ('Exhibidores', 'exhibidores', '#f59e0b', 1),
  ('Instalación de Vinil Profesional', 'vinil-profesional', '#10b981', 2),
  ('Laminado Vehicular', 'laminado-vehicular', '#3b82f6', 3),
  ('Láminas de Vidrio', 'laminas-vidrio', '#8b5cf6', 4),
  ('Melamine & Drywall', 'melamine-drywall', '#6366f1', 5),
  ('Pizarras Adhesivas', 'pizarras-adhesivas', '#ec4899', 6),
  ('Publicidad Impresa', 'publicidad-impresa', '#ef4444', 7),
  ('Revestimiento Adhesivos', 'revestimiento-adhesivos', '#14b8a6', 8),
  ('Señaléticas y Letreros', 'senaleticas-letreros', '#f97316', 9),
  ('Vinil Decorativo', 'vinil-decorativo', '#a855f7', 10)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Seed: Configuración inicial de empresa
-- ============================================================
INSERT INTO company_settings (company_name, default_margin, igv_rate, quotation_prefix, quotation_next_number)
SELECT 'Mi Empresa Gráfica', 30.00, 0.1800, 'COT', 1
WHERE NOT EXISTS (SELECT 1 FROM company_settings);
