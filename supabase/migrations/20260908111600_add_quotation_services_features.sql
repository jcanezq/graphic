-- ============================================================
-- Migration: Add fields for services (labor/design flags and file uploads)
-- ============================================================

-- Add new columns to quotation_items
ALTER TABLE quotation_items 
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'Producto',
  ADD COLUMN IF NOT EXISTS has_labor BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_design BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS design_cost NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_design_url TEXT;

-- Create the bucket for client designs if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-designs', 'client-designs', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for client-designs bucket
DROP POLICY IF EXISTS "auth_upload_client_designs" ON storage.objects;
CREATE POLICY "auth_upload_client_designs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-designs');
DROP POLICY IF EXISTS "public_read_client_designs" ON storage.objects;
CREATE POLICY "public_read_client_designs" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'client-designs');
DROP POLICY IF EXISTS "auth_delete_client_designs" ON storage.objects;
CREATE POLICY "auth_delete_client_designs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-designs');
DROP POLICY IF EXISTS "auth_update_client_designs" ON storage.objects;
CREATE POLICY "auth_update_client_designs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-designs');
