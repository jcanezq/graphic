-- ============================================================
-- TXT-T1 · Titular, bajada y texto del botón del banner.
--
-- Los tres OPCIONALES: un banner sin ellos se dibuja como hasta ahora, que es lo
-- que permite conservar las piezas con el texto ya quemado en la imagen.
--
-- Los topes de largo no son burocracia: el titular se pinta sobre el 45 % izquierdo
-- del banner, y un texto que no entra no se recorta solo — desborda o empuja.
-- Idempotente.
-- ============================================================

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS title     TEXT,
  ADD COLUMN IF NOT EXISTS subtitle  TEXT,
  ADD COLUMN IF NOT EXISTS cta_label TEXT;

ALTER TABLE public.home_banners
  DROP CONSTRAINT IF EXISTS home_banners_title_len,
  DROP CONSTRAINT IF EXISTS home_banners_subtitle_len,
  DROP CONSTRAINT IF EXISTS home_banners_cta_len;

ALTER TABLE public.home_banners
  ADD CONSTRAINT home_banners_title_len    CHECK (title     IS NULL OR length(title)     <= 60),
  ADD CONSTRAINT home_banners_subtitle_len CHECK (subtitle  IS NULL OR length(subtitle)  <= 120),
  ADD CONSTRAINT home_banners_cta_len      CHECK (cta_label IS NULL OR length(cta_label) <= 30);

COMMENT ON COLUMN public.home_banners.title IS
  'Titular visible, superpuesto por la aplicación. NO confundir con alt_text, que '
  'no se ve y describe la imagen para lectores de pantalla.';
