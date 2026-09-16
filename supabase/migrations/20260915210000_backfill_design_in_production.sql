-- El relleno de 20260909164200 y su repetición en 20260915200000 sólo miraban
-- filas con kind = 'other'. Pero en el modelo del negocio el DISEÑO vive dentro
-- de PRODUCCIÓN, así que esas filas nunca entraron en el WHERE y seguían
-- dependiendo del emparejamiento por texto.
--
-- Verificado antes de escribir esto: las tres filas que quedaban son diseño real
-- (Laminado Vehicular, Melamine y Drywall, Pizarras Adhesivas Premium). Ninguna
-- es un falso positivo, así que la conversión en bloque es segura. Idempotente.

UPDATE product_indirect_costs SET kind = 'design'
 WHERE kind = 'production'
   AND lower(translate(concept, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) LIKE ANY (ARRAY['%diseno%', '%design%']);

-- Simetría: un transporte mal clasificado como producción. Hoy no hay ninguno
-- (la consulta de control devolvió sólo las tres de diseño); la sentencia queda
-- por completitud y es inocua si no coincide con nada.
UPDATE product_indirect_costs SET kind = 'transport'
 WHERE kind = 'production'
   AND lower(translate(concept, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) LIKE ANY (ARRAY['%transporte%', '%movilidad%', '%flete%']);
