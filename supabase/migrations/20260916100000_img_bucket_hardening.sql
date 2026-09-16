-- ============================================================
-- IMG-T1: límites de MIME y peso por bucket + bucket privado de arte
-- Contexto: la validación del navegador es eludible (el cliente habla
-- directo con Storage). Esto es la única capa que no se puede saltar.
-- ============================================================

-- 1) Bucket de fotos de catálogo: existe en producción sin restricción de MIME.
--    Se lo deja público (es publicidad) pero se le cierra la entrada.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 10485760,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = 10485760,                       -- 10 MB (ML [OFICIAL])
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

-- 2) Bucket del logo: una sola imagen, la sube el dueño. Mismo cierre.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-assets', 'company-assets', true, 5242880,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = 5242880,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

-- 3) Bucket NUEVO y PRIVADO para el arte de producción del cliente.
--    public = false  ->  solo se sirve con URL firmada.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-art', 'client-art', false, 52428800,        -- 50 MB (techo del plan Free [OFICIAL])
        ARRAY['application/pdf','image/jpeg','image/png','image/tiff',
              'application/postscript','image/vnd.adobe.photoshop'])
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = 52428800,
      allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/png','image/tiff',
                                 'application/postscript','image/vnd.adobe.photoshop'];

-- 4) Políticas de 'client-art': por DUEÑO, no por bucket.
--    La carpeta raíz del objeto debe ser el uid del que escribe.
--    (storage.foldername(name))[1] es el primer segmento de la ruta.
DROP POLICY IF EXISTS "art_insert_own" ON storage.objects;
CREATE POLICY "art_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-art'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "art_select_own_or_admin" ON storage.objects;
CREATE POLICY "art_select_own_or_admin" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-art'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "art_update_own_or_admin" ON storage.objects;
CREATE POLICY "art_update_own_or_admin" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-art'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "art_delete_own_or_admin" ON storage.objects;
CREATE POLICY "art_delete_own_or_admin" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-art'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

-- 5) 'product-images': escritura solo de admin (es el catálogo de la empresa),
--    lectura pública. Reemplaza las políticas abiertas a cualquier autenticado.
DROP POLICY IF EXISTS "auth_upload_images"  ON storage.objects;
DROP POLICY IF EXISTS "auth_update_images"  ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_images"  ON storage.objects;

CREATE POLICY "admin_write_product_images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());
CREATE POLICY "admin_update_product_images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());
CREATE POLICY "admin_delete_product_images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());
-- 'public_read_images' (SELECT a rol public) se conserva tal como está en producción.
