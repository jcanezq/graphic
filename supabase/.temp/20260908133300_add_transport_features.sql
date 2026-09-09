ALTER TABLE quotation_items ADD COLUMN has_transport boolean DEFAULT true, ADD COLUMN transport_cost numeric(10,2) DEFAULT 0;
