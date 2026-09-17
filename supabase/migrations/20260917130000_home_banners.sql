-- ============================================================
-- BAN-T3 · Banners de la portada.
-- Los administra el administrador; los lee cualquiera, incluso sin sesión.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.home_banners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url   TEXT        NOT NULL,
  -- Obligatorio a propósito: un banner sin texto alternativo es una imagen muda
  -- para quien usa lector de pantalla, y acá el banner puede ser el mensaje
  -- comercial principal de la portada.
  alt_text    TEXT        NOT NULL CHECK (length(btrim(alt_text)) > 0),
  -- Destino opcional. Se valida también en el servidor y en la interfaz: acá se
  -- exige que sea una ruta interna o http(s), NUNCA otro esquema.
  link_url    TEXT        CHECK (link_url IS NULL OR link_url ~ '^(/|https?://)'),
  sort_order  INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.home_banners IS
  'Carrusel de la portada. Las piezas de arte viven en el bucket company-assets, '
  'carpeta banners/. Lectura pública; escritura sólo de administrador.';

CREATE INDEX IF NOT EXISTS home_banners_orden_idx
  ON public.home_banners (sort_order, created_at) WHERE is_active;

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banners_public_read" ON public.home_banners;
DROP POLICY IF EXISTS "banners_admin_all"   ON public.home_banners;

-- Lectura para todo el mundo, con sesión o sin ella: es la portada.
-- Sólo los activos; un banner desactivado es trabajo interno y no se publica.
CREATE POLICY "banners_public_read" ON public.home_banners
  FOR SELECT TO anon, authenticated USING (is_active);

CREATE POLICY "banners_admin_all" ON public.home_banners
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON TABLE public.home_banners TO anon, authenticated;
