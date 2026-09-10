ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS has_transport  boolean       DEFAULT true,
  ADD COLUMN IF NOT EXISTS transport_cost numeric(12,2) DEFAULT 0;
-- numeric(12,2) unifica con el resto de los importes (ver F3-T11)
