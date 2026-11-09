-- ============================================================
-- Restricción de unicidad para DNI / RUC en clientes (2026-11-09)
-- ============================================================

-- 1. Normalizar espacios en blanco en ruc existentes
UPDATE public.clients
SET ruc = TRIM(ruc)
WHERE ruc IS NOT NULL;

-- 2. Resolver duplicados preexistentes marcando con deleted_at
-- Conserva el cliente con mayor cantidad de cotizaciones y el registro más reciente.
WITH client_quote_counts AS (
  SELECT c.id,
         COUNT(q.id) AS quotes_count
  FROM public.clients c
  LEFT JOIN public.quotations q ON q.client_name = c.name AND q.deleted_at IS NULL
  WHERE c.deleted_at IS NULL
    AND c.ruc IS NOT NULL
    AND TRIM(c.ruc) != ''
  GROUP BY c.id
),
ranked_clients AS (
  SELECT c.id,
         c.ruc,
         c.name,
         ROW_NUMBER() OVER (
           PARTITION BY TRIM(c.ruc)
           ORDER BY COALESCE(qc.quotes_count, 0) DESC, c.created_at DESC
         ) AS rank_order
  FROM public.clients c
  JOIN client_quote_counts qc ON qc.id = c.id
  WHERE c.deleted_at IS NULL
    AND c.ruc IS NOT NULL
    AND TRIM(c.ruc) != ''
)
UPDATE public.clients
SET deleted_at = NOW()
WHERE id IN (
  SELECT id FROM ranked_clients WHERE rank_order > 1
);

-- 3. Crear índice único sobre ruc/dni para clientes activos
-- Permite que varios clientes tengan ruc NULL o vacío, pero prohíbe
-- que dos clientes activos compartan el mismo número de documento.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_unique_active_ruc
ON public.clients (TRIM(ruc))
WHERE deleted_at IS NULL AND ruc IS NOT NULL AND TRIM(ruc) != '';

