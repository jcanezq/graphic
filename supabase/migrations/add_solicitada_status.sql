-- ============================================================
-- Migration: Add 'solicitada' status for client web quotes
-- ============================================================

-- Update check constraint on quotations table to allow 'solicitada'
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
ALTER TABLE quotations ADD CONSTRAINT quotations_status_check 
  CHECK (status IN ('solicitada', 'borrador', 'enviada', 'aceptada', 'rechazada', 'vencida'));
