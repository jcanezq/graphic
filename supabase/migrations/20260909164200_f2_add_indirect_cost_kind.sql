-- FASE 2 · Identificador estable para los componentes de servicio.
-- Reemplaza la clasificación por coincidencia de texto en `concept`, que dependía
-- de la tilde de "Diseño" y cambiaba el precio según cómo se hubiera tipeado.
ALTER TABLE product_indirect_costs
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('design', 'transport', 'other'));

-- Backfill: misma semántica que el código que se retira, pero insensible a
-- tildes y mayúsculas (unaccent manual vía translate, para no depender de la
-- extensión unaccent).
UPDATE product_indirect_costs SET kind = 'design'
 WHERE kind = 'other'
   AND lower(translate(concept, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) LIKE ANY (ARRAY['%diseno%', '%design%']);

UPDATE product_indirect_costs SET kind = 'transport'
 WHERE kind = 'other'
   AND lower(translate(concept, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) LIKE ANY (ARRAY['%transporte%', '%movilidad%', '%flete%']);

-- Control: listar lo que quedó clasificado, para revisión humana.
-- SELECT kind, concept, cost FROM product_indirect_costs ORDER BY kind, concept;
