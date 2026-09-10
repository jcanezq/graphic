-- ============================================================
-- Migration: Permite lectura pública del catálogo de productos y categorías
-- Ejecutar en: Supabase Dashboard → SQL Editor (si se requiere lectura directa por anon)
-- ============================================================

-- 1. Lectura de categorías para el público
DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories
  FOR SELECT TO public
  USING (deleted_at IS NULL);

-- 2. Lectura de productos activos para el público
DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products
  FOR SELECT TO public
  USING (is_active = true AND deleted_at IS NULL);

-- 3. Lectura de configuración de la empresa (nombre, logo, teléfono)
DROP POLICY IF EXISTS "public_read_company_settings" ON company_settings;
CREATE POLICY "public_read_company_settings" ON company_settings
  FOR SELECT TO public
  USING (true);
