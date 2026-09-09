-- ============================================================
-- F1-T4 · Permisos mínimos de ejecución en las RPC (H-18, H-01 punto 3)
-- Postgres concede EXECUTE a PUBLIC al crear una función, y en Supabase
-- anon hereda de PUBLIC: ambas RPC estaban expuestas a la clave pública.
-- Idempotente (REVOKE/GRANT son declarativos).
-- ============================================================

-- generate_quotation_number(): la usa el dashboard (usuario autenticado)
-- y la ruta de servidor /api/client/quotations (service_role).
REVOKE ALL     ON FUNCTION public.generate_quotation_number() FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.generate_quotation_number() FROM anon;
GRANT  EXECUTE ON FUNCTION public.generate_quotation_number() TO authenticated, service_role;

-- replace_quotation_items(): sólo la llama el dashboard
-- (src/app/dashboard/cotizaciones/[id]/page.tsx:212). anon no la necesita.
REVOKE ALL     ON FUNCTION public.replace_quotation_items(UUID, JSONB) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.replace_quotation_items(UUID, JSONB) FROM anon;
GRANT  EXECUTE ON FUNCTION public.replace_quotation_items(UUID, JSONB) TO authenticated;
