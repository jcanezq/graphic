-- ============================================================
-- BUCKET-T1 · Quitar la política heredada que deja escribir en
-- `company-assets` a cualquier usuario autenticado.
--
-- `20260917120000` agregó las tres políticas de administrador y NO alcanzó: las
-- políticas de RLS se SUMAN, y la vieja seguía viva. Su nombre no está en
-- ninguna migración de este repositorio —se creó a mano en el panel—, así que no
-- se puede borrar por nombre: se borra por lo que HACE.
--
-- Medido el 2026-09-17, misma sesión de cliente contra los cuatro buckets:
-- company-assets 200; product-images, client-art y client-designs 400. Eso
-- descarta una política global y prueba que hay uno específico de este bucket.
--
-- NO se tocan las políticas de SELECT: el logo y los banners tienen que poder
-- verse sin sesión.
-- Idempotente.
-- ============================================================

DO $$
DECLARE
  r RECORD;
  quitadas INT := 0;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      -- sólo escritura: SELECT se conserva intacto
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND COALESCE(qual, '') || COALESCE(with_check, '') LIKE '%company-assets%'
      -- las tres de 20260917120000 son las correctas y se quedan
      AND policyname NOT IN (
        'admin_write_company_assets',
        'admin_update_company_assets',
        'admin_delete_company_assets'
      )
  LOOP
    RAISE NOTICE 'Quitando política heredada sobre company-assets: %', r.policyname;
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    quitadas := quitadas + 1;
  END LOOP;

  RAISE NOTICE 'Políticas heredadas quitadas: %', quitadas;
END $$;
