-- ============================================================
-- El bucket 'client-designs' era público Y sus políticas no miraban de quién
-- era el archivo: cualquier usuario registrado podía leer, pisar o borrar el
-- arte de otro cliente. Se cierra.
--
-- El arte nuevo vive en 'client-art' (privado, políticas por dueño, creado en
-- 20260916100000) y se entrega firmado por /api/art.
--
-- ☠ Esto mata todo enlace público ya compartido. Autorizado por el dueño el
--   2026-09-15: las cotizaciones existentes son de prueba.
-- ============================================================

UPDATE storage.buckets SET public = false WHERE id = 'client-designs';

DROP POLICY IF EXISTS "public_read_client_designs"   ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_client_designs"   ON storage.objects;
DROP POLICY IF EXISTS "auth_update_client_designs"   ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_client_designs"   ON storage.objects;

COMMENT ON COLUMN quotation_items.client_design_url IS
  'Ruta del arte del cliente dentro del bucket privado client-art (<uid>/<archivo>). '
  'El nombre dice URL por historia: los valores que empiezan con http son heredados y '
  'ya no resuelven. Se entrega firmado por /api/art.';
