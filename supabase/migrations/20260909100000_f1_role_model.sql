-- ============================================================
-- F1-T3 · Modelo de roles en Postgres
-- Habilita políticas RLS que distinguen administrador de cliente.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_roles_pkey      PRIMARY KEY (user_id, role),
  CONSTRAINT user_roles_role_chk  CHECK (role IN ('admin'))
);

COMMENT ON TABLE public.user_roles IS
  'Autoridad de roles del lado de Postgres. Sembrada a mano (F1-T3). '
  'El middleware de Next.js (src/middleware.ts) decide el enrutado de la UI; '
  'ESTA tabla decide el acceso a los datos. Deben mantenerse coherentes.';

-- El helper. SECURITY DEFINER es deliberado: evita la recursión de RLS al leer user_roles
-- desde una política de user_roles. No recibe parámetros del llamador.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    -- service_role (rutas de servidor) siempre cuenta como administrador.
    -- current_setting(..., true) devuelve NULL si no hay JWT (p. ej. psql) -> FALSE.
    COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    );
$$;

REVOKE ALL     ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- La tabla de roles sólo la ve y la administra un administrador.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.user_roles FROM anon;
