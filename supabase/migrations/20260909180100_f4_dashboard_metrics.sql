-- PENDIENTE DE APLICAR
-- F4-T16: Mover las métricas del dashboard a una RPC
-- Devuelve las métricas ya agregadas para no traer la tabla quotations ni quotation_items completa al cliente.

CREATE OR REPLACE FUNCTION dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'total_revenue', COALESCE((SELECT SUM(total) FROM quotations WHERE status = 'aceptada' AND deleted_at IS NULL), 0),
        'total_quotations', (SELECT COUNT(*) FROM quotations WHERE deleted_at IS NULL),
        'by_status', (
            SELECT json_object_agg(status, count)
            FROM (
                SELECT status, COUNT(*) as count 
                FROM quotations 
                WHERE deleted_at IS NULL 
                GROUP BY status
            ) s
        ),
        'top_clients', (
            SELECT COALESCE(json_agg(row_to_json(tc)), '[]'::json)
            FROM (
                SELECT client_name, SUM(total) as ltv
                FROM quotations
                WHERE status = 'aceptada' AND deleted_at IS NULL
                GROUP BY client_name
                ORDER BY ltv DESC
                LIMIT 5
            ) tc
        ),
        'expiring_soon', (
            SELECT COALESCE(json_agg(row_to_json(es)), '[]'::json)
            FROM (
                SELECT id, number, client_name, (created_at + (validity_days || ' days')::interval) as expires_at
                FROM quotations
                WHERE status IN ('borrador', 'enviada') AND deleted_at IS NULL
                AND (created_at + (validity_days || ' days')::interval) BETWEEN NOW() AND NOW() + INTERVAL '7 days'
                ORDER BY expires_at ASC
                LIMIT 5
            ) es
        ),
        'monthly_series', (
            SELECT COALESCE(json_agg(row_to_json(ms)), '[]'::json)
            FROM (
                SELECT 
                    to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
                    SUM(CASE WHEN status = 'aceptada' THEN total ELSE 0 END) as revenue,
                    COUNT(*) as count
                FROM quotations
                WHERE deleted_at IS NULL AND created_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
                GROUP BY date_trunc('month', created_at)
                ORDER BY date_trunc('month', created_at) ASC
            ) ms
        )
    ) INTO result;

    RETURN result;
END;
$$;
