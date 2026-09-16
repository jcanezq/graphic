-- Repite el relleno de 20260909164200 sobre las filas que el formulario degradó.
-- Motivo: hasta KIND-T1, CatalogFormPage borraba todos los indirectos de un
-- artículo y sólo reinsertaba los de kind 'production' y 'other', así que las
-- filas de diseño y transporte que sobrevivieron quedaron como 'other'.
-- Misma semántica que el original: sin tildes, sin mayúsculas, con translate()
-- para no depender de la extensión unaccent. Idempotente.

UPDATE product_indirect_costs SET kind = 'design'
 WHERE kind = 'other'
   AND lower(translate(concept, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) LIKE ANY (ARRAY['%diseno%', '%design%']);

UPDATE product_indirect_costs SET kind = 'transport'
 WHERE kind = 'other'
   AND lower(translate(concept, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) LIKE ANY (ARRAY['%transporte%', '%movilidad%', '%flete%']);
