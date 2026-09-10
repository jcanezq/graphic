-- ============================================================
-- Migration: Add 'pagado' status and payment_method for quotations
-- ============================================================

-- Update check constraint on quotations table to allow 'pagado'
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
ALTER TABLE quotations ADD CONSTRAINT quotations_status_check 
  CHECK (status IN ('solicitada', 'borrador', 'enviada', 'aceptada', 'rechazada', 'vencida', 'pagado'));

-- Add payment_method column
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('Yape', 'Plin', 'Efectivo', 'Transferencia', 'Tarjeta'));
