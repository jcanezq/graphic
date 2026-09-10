-- PENDIENTE DE APLICAR
-- F4-T15: Paginar clientes en servidor y matar el O(n×m)
-- Vista que devuelve los clientes junto con sus estadísticas agregadas desde la tabla de cotizaciones.
-- Esto evita tener que descargar ambas tablas completas en memoria.

DROP VIEW IF EXISTS clients_with_stats;
CREATE VIEW clients_with_stats AS
SELECT 
    c.id,
    c.ruc,
    c.name,
    c.address,
    c.phone,
    c.email,
    c.created_at,
    COUNT(q.id) AS quotation_count,
    COALESCE(SUM(CASE WHEN q.status = 'aceptada' THEN q.total ELSE 0 END), 0) AS ltv,
    MAX(q.created_at) AS last_quotation_date
FROM clients c
LEFT JOIN quotations q ON q.client_name = c.name AND q.deleted_at IS NULL
GROUP BY c.id;
