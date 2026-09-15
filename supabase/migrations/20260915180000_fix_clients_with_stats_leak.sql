-- ============================================================
-- clients_with_stats estaba legible por el rol anon (HTTP 200, 6 filas
-- con ruc, nombre, dirección, teléfono, correo y datos comerciales).
--
-- Causa: 20260909180000_f4_clients_with_stats.sql la creó con un CREATE VIEW
-- pelado. Una vista corre con los permisos de su creador —el dueño de la
-- base— salvo que declare security_invoker, así que el RLS de public.clients
-- no se evaluaba nunca.
--
-- (1) security_invoker: la vista pasa a ejecutarse con los permisos de quien
--     pregunta, de modo que choca con el mismo RLS que ya frena a la tabla.
-- (2) REVOKE: cinturón y tirantes. Si alguien vuelve a redefinir la vista y
--     olvida el punto (1) —que es exactamente lo que pasó con el RPC
--     replace_quotation_items— el REVOKE sigue tapando el agujero.
-- ============================================================

ALTER VIEW public.clients_with_stats SET (security_invoker = true);

REVOKE ALL ON public.clients_with_stats FROM anon;
