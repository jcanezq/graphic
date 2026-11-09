-- ============================================================
-- Mantenedores de Categorías y Unidades de medida (2026-11-09)
-- ============================================================

-- 1. Tabla categories (garantizar existencia si falta en entorno local)
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  color text,
  icon text,
  sort_order int,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Columna is_active en categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Restricción UNIQUE en categories.slug
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.categories'::regclass
      AND contype = 'u'
      AND conname = 'categories_slug_key'
  ) THEN
    ALTER TABLE public.categories ADD CONSTRAINT categories_slug_key UNIQUE (slug);
  END IF;
END $$;

-- RLS y permisos endurecidos en categories (sin DELETE, UPDATE sólo en campos editables)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_write_categories" ON public.categories;
DROP POLICY IF EXISTS "admin_insert_categories" ON public.categories;
DROP POLICY IF EXISTS "admin_update_categories" ON public.categories;

CREATE POLICY "admin_insert_categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_categories" ON public.categories
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "auth_read_categories" ON public.categories;
CREATE POLICY "auth_read_categories" ON public.categories
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

REVOKE ALL ON TABLE public.categories FROM anon;
GRANT SELECT, INSERT ON TABLE public.categories TO authenticated;
REVOKE DELETE ON TABLE public.categories FROM authenticated;
REVOKE UPDATE ON TABLE public.categories FROM authenticated;
GRANT UPDATE (name, color, icon, sort_order, is_active) ON TABLE public.categories TO authenticated;

-- 2. Tabla units nueva
CREATE TABLE IF NOT EXISTS public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order int,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_sort_order ON public.units (sort_order);

-- Trigger de updated_at para units
DROP TRIGGER IF EXISTS trg_units_updated_at ON public.units;
CREATE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed de unidades: las 10 de BasicInfoSection.tsx + las detectadas en producción
INSERT INTO public.units (code, label, sort_order, is_active)
VALUES
  ('m²', 'Metro cuadrado (m²)', 1, true),
  ('unidad', 'Unidad', 2, true),
  ('kit', 'Kit', 3, true),
  ('servicio', 'Servicio', 4, true),
  ('ml', 'Metro lineal (ml)', 5, true),
  ('metro', 'Metro', 6, true),
  ('hora-técnico / visita', 'hora-técnico / visita', 7, true),
  ('m² de vehículo', 'm² de vehículo', 8, true),
  ('m² instalado', 'm² instalado', 9, true),
  ('m² de mueble/tabique', 'm² de mueble/tabique', 10, true),
  ('m lineal', 'Metro lineal', 11, true),
  ('juego', 'Juego', 12, true)
ON CONFLICT (code) DO NOTHING;

-- FK products.unit -> units(code)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'fk_products_unit'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT fk_products_unit
      FOREIGN KEY (unit) REFERENCES public.units(code)
      ON UPDATE RESTRICT ON DELETE RESTRICT
      NOT VALID;
    
    ALTER TABLE public.products VALIDATE CONSTRAINT fk_products_unit;
  END IF;
END $$;

-- RLS y permisos endurecidos en units (sin DELETE, UPDATE sólo en columnas editables)
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_insert_units" ON public.units;
CREATE POLICY "admin_insert_units" ON public.units
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_units" ON public.units;
CREATE POLICY "admin_update_units" ON public.units
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "auth_read_units" ON public.units;
CREATE POLICY "auth_read_units" ON public.units
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON TABLE public.units FROM anon;
GRANT SELECT, INSERT ON TABLE public.units TO authenticated;
REVOKE DELETE ON TABLE public.units FROM authenticated;
REVOKE UPDATE ON TABLE public.units FROM authenticated;
GRANT UPDATE (label, sort_order, is_active) ON TABLE public.units TO authenticated;
