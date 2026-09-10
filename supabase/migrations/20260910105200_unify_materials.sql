-- ============================================================
-- Migration: Unify Materials into Products table
-- ============================================================

-- 1. Insert materials into products table, keeping their UUID so relations remain intact.
INSERT INTO products (id, code, name, type, unit, manual_unit_cost, is_active, created_at, updated_at, deleted_at)
SELECT 
    id,
    'MAT-' || upper(substr(md5(id::text), 1, 6)) AS code,
    name,
    'Material' AS type,
    unit,
    cost AS manual_unit_cost,
    true AS is_active,
    created_at,
    updated_at,
    deleted_at
FROM materials
ON CONFLICT (id) DO NOTHING;

-- 2. Drop the existing foreign key constraint from product_materials to materials
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'product_materials'::regclass
      AND confrelid = 'materials'::regclass
      AND contype = 'f';

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE product_materials DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

-- 3. Add the new foreign key pointing to products
ALTER TABLE product_materials
  ADD CONSTRAINT product_materials_material_id_fkey 
  FOREIGN KEY (material_id) REFERENCES products(id) ON DELETE SET NULL;

-- 4. Rename old materials table (optional backup)
ALTER TABLE materials RENAME TO materials_deprecated;

-- 5. Enable RLS on the new products (already enabled, but let's ensure policies apply)
-- Since products table policies are auth_all_products, they will cover the new rows.
