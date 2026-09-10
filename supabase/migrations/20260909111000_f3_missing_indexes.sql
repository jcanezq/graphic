-- ============================================================
-- F3-T9 · Índices faltantes (H-13)
-- Contrastados contra las consultas reales de la app.
-- Idempotente.
-- ============================================================

-- 1. El más urgente: ORDER BY created_at DESC + .is("deleted_at", null)
CREATE INDEX IF NOT EXISTS idx_quotations_created_at
  ON public.quotations (created_at DESC) WHERE deleted_at IS NULL;

-- 2-6. Las cinco FKs sin índice
CREATE INDEX IF NOT EXISTS idx_quotation_items_product
  ON public.quotation_items (product_id);
CREATE INDEX IF NOT EXISTS idx_product_materials_product
  ON public.product_materials (product_id);
CREATE INDEX IF NOT EXISTS idx_product_materials_material
  ON public.product_materials (material_id);
CREATE INDEX IF NOT EXISTS idx_product_labor_product
  ON public.product_labor (product_id);
CREATE INDEX IF NOT EXISTS idx_product_indirect_product
  ON public.product_indirect_costs (product_id);

-- 7. Ítems ordenados dentro de una cotización
CREATE INDEX IF NOT EXISTS idx_quotation_items_quot_sort
  ON public.quotation_items (quotation_id, sort_order);

-- 8. Catálogo del dashboard
CREATE INDEX IF NOT EXISTS idx_products_catalog
  ON public.products (type, created_at DESC) WHERE is_active AND deleted_at IS NULL;

-- 9. Búsqueda de clientes por RUC
CREATE INDEX IF NOT EXISTS idx_clients_ruc
  ON public.clients (ruc) WHERE ruc IS NOT NULL;

-- 10. Orden de categorías
CREATE INDEX IF NOT EXISTS idx_categories_sort
  ON public.categories (sort_order);

-- 11-12. Búsqueda por texto que la app SÍ puede usar.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
DROP INDEX IF EXISTS public.idx_products_name;          -- el GIN inútil
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_quotations_client_trgm
  ON public.quotations USING gin (client_name gin_trgm_ops);

-- Índices redundantes: duplican los índices únicos de code y number (H-22)
DROP INDEX IF EXISTS public.idx_products_code;
DROP INDEX IF EXISTS public.idx_quotations_number;
