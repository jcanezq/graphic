-- ============================================================
-- F1-T6 · Aislamiento real en RLS (H-10)
-- Reemplaza las 9 políticas "FOR ALL TO authenticated USING (true)".
-- Requiere public.is_admin() (F1-T3).
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE.
-- ============================================================

-- Salvaguarda: si is_admin() no existe, abortar antes de tocar nada.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='public' AND p.proname='is_admin') THEN
    RAISE EXCEPTION 'Falta public.is_admin(): aplicá primero F1-T3 (20260909100000)';
  END IF;
END $$;

-- ---------- quotations ----------
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_quotations"      ON public.quotations;
DROP POLICY IF EXISTS "admin_all_quotations"     ON public.quotations;
DROP POLICY IF EXISTS "client_select_own_quotes" ON public.quotations;

CREATE POLICY "admin_all_quotations" ON public.quotations
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "client_select_own_quotes" ON public.quotations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------- quotation_items ----------
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_items"          ON public.quotation_items;
DROP POLICY IF EXISTS "admin_all_items"         ON public.quotation_items;
DROP POLICY IF EXISTS "client_select_own_items" ON public.quotation_items;

CREATE POLICY "admin_all_items" ON public.quotation_items
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "client_select_own_items" ON public.quotation_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotations q
    WHERE q.id = quotation_id AND q.user_id = auth.uid()
  ));

-- ---------- clients (CRM: sólo administrador) ----------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_clients"                 ON public.clients;
DROP POLICY IF EXISTS "Authenticated can manage clients" ON public.clients;
DROP POLICY IF EXISTS "admin_all_clients"                ON public.clients;

CREATE POLICY "admin_all_clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- catálogo: escritura de admin, lectura de autenticado ----------
ALTER TABLE public.products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_products"          ON public.products;
DROP POLICY IF EXISTS "public_read_products"       ON public.products;
DROP POLICY IF EXISTS "admin_write_products"       ON public.products;
DROP POLICY IF EXISTS "auth_read_products"         ON public.products;
CREATE POLICY "admin_write_products" ON public.products
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "auth_read_products" ON public.products
  FOR SELECT TO authenticated USING (is_active AND deleted_at IS NULL);

DROP POLICY IF EXISTS "auth_all_categories"    ON public.categories;
DROP POLICY IF EXISTS "public_read_categories" ON public.categories;
DROP POLICY IF EXISTS "admin_write_categories" ON public.categories;
DROP POLICY IF EXISTS "auth_read_categories"   ON public.categories;
CREATE POLICY "admin_write_categories" ON public.categories
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "auth_read_categories" ON public.categories
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "auth_all_master_materials" ON public.materials;
DROP POLICY IF EXISTS "admin_write_materials"     ON public.materials;
DROP POLICY IF EXISTS "auth_read_materials"       ON public.materials;
CREATE POLICY "admin_write_materials" ON public.materials
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "auth_read_materials" ON public.materials
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

-- ---------- desglose de costos: SÓLO administrador ----------
ALTER TABLE public.product_materials       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_labor           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_indirect_costs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_materials"    ON public.product_materials;
DROP POLICY IF EXISTS "admin_all_prod_mat"    ON public.product_materials;
CREATE POLICY "admin_all_prod_mat" ON public.product_materials
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "auth_all_labor"        ON public.product_labor;
DROP POLICY IF EXISTS "admin_all_prod_labor"  ON public.product_labor;
CREATE POLICY "admin_all_prod_labor" ON public.product_labor
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "auth_all_indirects"       ON public.product_indirect_costs;
DROP POLICY IF EXISTS "admin_all_prod_indirect"  ON public.product_indirect_costs;
CREATE POLICY "admin_all_prod_indirect" ON public.product_indirect_costs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- company_settings: SÓLO administrador ----------
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_settings"           ON public.company_settings;
DROP POLICY IF EXISTS "public_read_company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "admin_all_settings"          ON public.company_settings;
CREATE POLICY "admin_all_settings" ON public.company_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- quitarle a anon el acceso a las tablas sensibles ----------
REVOKE ALL ON TABLE public.products                 FROM anon;
REVOKE ALL ON TABLE public.categories               FROM anon;
REVOKE ALL ON TABLE public.materials                FROM anon;
REVOKE ALL ON TABLE public.product_materials        FROM anon;
REVOKE ALL ON TABLE public.product_labor            FROM anon;
REVOKE ALL ON TABLE public.product_indirect_costs   FROM anon;
REVOKE ALL ON TABLE public.company_settings         FROM anon;
REVOKE ALL ON TABLE public.quotations               FROM anon;
REVOKE ALL ON TABLE public.quotation_items          FROM anon;
REVOKE ALL ON TABLE public.clients                  FROM anon;
