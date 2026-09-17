-- ============================================================
-- BAN-T1 · `company-assets` sólo lo escribe un administrador.
--
-- Medido el 2026-09-17: con la sesión de un cliente cualquiera, subir un PNG a
-- `company-assets` devolvía 200. `20260916100000_img_bucket_hardening.sql`
-- endureció `product-images` y `client-art` y dejó este bucket afuera.
--
-- Es el bucket del logo y —desde este spec— el de los banners de la portada:
-- escritura abierta significa que cualquiera que se registre puede reemplazar
-- lo que ve todo el que entra al sitio.
--
-- La lectura pública NO se toca: el logo y los banners tienen que poder verse
-- sin sesión.
-- Idempotente.
-- ============================================================

DROP POLICY IF EXISTS "admin_write_company_assets"  ON storage.objects;
DROP POLICY IF EXISTS "admin_update_company_assets" ON storage.objects;
DROP POLICY IF EXISTS "admin_delete_company_assets" ON storage.objects;

CREATE POLICY "admin_write_company_assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets' AND public.is_admin());
CREATE POLICY "admin_update_company_assets" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets' AND public.is_admin());
CREATE POLICY "admin_delete_company_assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-assets' AND public.is_admin());
