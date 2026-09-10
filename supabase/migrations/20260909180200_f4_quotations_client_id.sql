-- PENDIENTE DE APLICAR
-- F4-T17: Ligar las cotizaciones al cliente por FK, no por su nombre en texto.
-- Migración con backfill de datos.

-- 1. Consulta de diagnóstico (solo lectura, para que la ejecutes antes de aplicar el ALTER y veas cuántos huérfanos quedarían)
/*
SELECT COUNT(*) as orfan_count, client_name 
FROM quotations q
LEFT JOIN clients c ON c.name = q.client_name
WHERE c.id IS NULL
GROUP BY client_name;
*/

-- 2. Modificaciones estructurales
ALTER TABLE quotations ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- 3. Backfill de datos de producción
UPDATE quotations q
SET client_id = c.id
FROM clients c
WHERE q.client_name = c.name;

-- 4. Modificar constraint onConflict en la lógica de aplicación (esto se hace en JS, pero dejo el recordatorio)
-- En JS: { onConflict: "ruc" } en lugar de "name".
