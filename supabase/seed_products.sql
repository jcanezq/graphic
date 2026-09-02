-- ============================================================
-- SEED: Insert products and cost structures from Excel
-- Auto-generated script
-- ============================================================

BEGIN;

-- MASTER MATERIALS
INSERT INTO materials (id, name, unit, cost) VALUES ('90981985-5946-47e6-a7a8-bddeb42dc58e', 'Vinil pizarra premium', 'm²', 0) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('8d0f5f66-97d4-4fc5-8658-8f8dc9b78ab3', 'Laminado protector antirayas', 'm²', 0) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('c13affc6-b0fa-46db-b947-261a44754ce4', 'Vinil decorativo', 'm²', 38) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('cde4f171-87a8-4e13-926f-39daeaf50d51', 'Adhesivo / pegamento especial', 'm²', 6) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('fea1e66f-5b13-49b7-968c-370844366c61', 'Laminado protector', 'm²', 6) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('9577a218-ad4a-41af-a28b-f7713e3fbc32', 'Lámina de seguridad / control solar', 'm²', 55) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('2c69b837-cc59-4f74-81a0-c08b80c63817', 'Tablero melamine 18mm', 'm²', 140) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('233b69fc-ab0f-4db1-9dee-2dead10bf284', 'Cantos / tapacantos', 'm lineal', 1.2) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('2cc49349-1512-4b1e-a476-679bd1c60894', 'Herrajes (bisagras, correderas, jaladores)', 'juego', 40) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('57e49b27-a655-495c-b835-597df0f98b46', 'Lona / banner / mesh base', 'm²', 10) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('0b32e806-4125-40c6-b6ee-f1fa3f066d7a', 'Acrílico / PVC', 'unidad', 40) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('ee90f199-d21a-49e8-8010-e9f988440548', 'Módulos LED e iluminación', 'unidad', 25) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('5d99baea-c9c6-4fc6-8f17-ecf64f4b003d', 'Acrílico / PVC / MDF', 'unidad', 35) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('f93229c0-8f27-4df3-9ece-2de15da3ff61', 'Vinil laminado premium', 'm²', 30) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('04df005c-c061-4d26-ad38-1b17534ea93b', 'Laminado de protección de pintura', 'm²', 10) ON CONFLICT (name) DO NOTHING;
INSERT INTO materials (id, name, unit, cost) VALUES ('7283748b-6645-4b2f-ac3a-52d6a7507977', 'Insumos menores de fijación (tornillos, silicona, cinta)', 'servicio', 10) ON CONFLICT (name) DO NOTHING;

-- PRODUCTO: Pizarras Adhesivas Premium Personalizadas
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  'c38ec80a-eca8-4c42-b92f-303356c6e3e0',
  'PRD-2026-0001',
  'Pizarras Adhesivas Premium Personalizadas',
  (SELECT id FROM categories WHERE name = 'Pizarras Adhesivas' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

DELETE FROM product_materials WHERE product_id = 'c38ec80a-eca8-4c42-b92f-303356c6e3e0';
DELETE FROM product_labor WHERE product_id = 'c38ec80a-eca8-4c42-b92f-303356c6e3e0';
DELETE FROM product_indirect_costs WHERE product_id = 'c38ec80a-eca8-4c42-b92f-303356c6e3e0';

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ('c38ec80a-eca8-4c42-b92f-303356c6e3e0', '90981985-5946-47e6-a7a8-bddeb42dc58e', 'Vinil pizarra premium', 1, 0, 'm²'),
  ('c38ec80a-eca8-4c42-b92f-303356c6e3e0', '8d0f5f66-97d4-4fc5-8658-8f8dc9b78ab3', 'Laminado protector antirayas', 1, 0, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('c38ec80a-eca8-4c42-b92f-303356c6e3e0', 'Instalación especializada', 1, 0);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('c38ec80a-eca8-4c42-b92f-303356c6e3e0', 'Impresión / corte digital', 0),
  ('c38ec80a-eca8-4c42-b92f-303356c6e3e0', 'Diseño gráfico (prorrateado)', 0),
  ('c38ec80a-eca8-4c42-b92f-303356c6e3e0', 'Transporte y logística', 0),
  ('c38ec80a-eca8-4c42-b92f-303356c6e3e0', 'Empaque y protección', 0);

-- PRODUCTO: Revestimientos Adhesivos
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  'aaac7d28-3299-46bb-a8ba-73b71a4ea7fe',
  'PRD-2026-0002',
  'Revestimientos Adhesivos',
  (SELECT id FROM categories WHERE name = 'Revestimiento Adhesivos' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

DELETE FROM product_materials WHERE product_id = 'aaac7d28-3299-46bb-a8ba-73b71a4ea7fe';
DELETE FROM product_labor WHERE product_id = 'aaac7d28-3299-46bb-a8ba-73b71a4ea7fe';
DELETE FROM product_indirect_costs WHERE product_id = 'aaac7d28-3299-46bb-a8ba-73b71a4ea7fe';

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ('aaac7d28-3299-46bb-a8ba-73b71a4ea7fe', 'c13affc6-b0fa-46db-b947-261a44754ce4', 'Vinil decorativo', 1, 38, 'm²'),
  ('aaac7d28-3299-46bb-a8ba-73b71a4ea7fe', 'cde4f171-87a8-4e13-926f-39daeaf50d51', 'Adhesivo / pegamento especial', 1, 6, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('aaac7d28-3299-46bb-a8ba-73b71a4ea7fe', 'Instalación', 1, 30);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('aaac7d28-3299-46bb-a8ba-73b71a4ea7fe', 'Impresión digital (diseño personalizado)', 9),
  ('aaac7d28-3299-46bb-a8ba-73b71a4ea7fe', 'Transporte', 15);

-- PRODUCTO: Vinilos Decorativos para Superficies
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  'a083dcb3-07e0-462e-add1-93269678b075',
  'PRD-2026-0003',
  'Vinilos Decorativos para Superficies',
  (SELECT id FROM categories WHERE name = 'Vinil Decorativo' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

DELETE FROM product_materials WHERE product_id = 'a083dcb3-07e0-462e-add1-93269678b075';
DELETE FROM product_labor WHERE product_id = 'a083dcb3-07e0-462e-add1-93269678b075';
DELETE FROM product_indirect_costs WHERE product_id = 'a083dcb3-07e0-462e-add1-93269678b075';

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ('a083dcb3-07e0-462e-add1-93269678b075', 'c13affc6-b0fa-46db-b947-261a44754ce4', 'Vinil decorativo', 1, 25, 'm²'),
  ('a083dcb3-07e0-462e-add1-93269678b075', 'fea1e66f-5b13-49b7-968c-370844366c61', 'Laminado protector', 1, 6, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('a083dcb3-07e0-462e-add1-93269678b075', 'Instalación', 1, 15);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('a083dcb3-07e0-462e-add1-93269678b075', 'Impresión ecosolvente de alta', 10),
  ('a083dcb3-07e0-462e-add1-93269678b075', 'Plotter de corte', 6),
  ('a083dcb3-07e0-462e-add1-93269678b075', 'Transporte', 15);

-- PRODUCTO: Láminas para Vidrio
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  '401c2212-3206-4381-a803-aed1d985c35d',
  'PRD-2026-0004',
  'Láminas para Vidrio',
  (SELECT id FROM categories WHERE name = 'Láminas de Vidrio' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

DELETE FROM product_materials WHERE product_id = '401c2212-3206-4381-a803-aed1d985c35d';
DELETE FROM product_labor WHERE product_id = '401c2212-3206-4381-a803-aed1d985c35d';
DELETE FROM product_indirect_costs WHERE product_id = '401c2212-3206-4381-a803-aed1d985c35d';

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ('401c2212-3206-4381-a803-aed1d985c35d', '9577a218-ad4a-41af-a28b-f7713e3fbc32', 'Lámina de seguridad / control solar', 1, 55, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('401c2212-3206-4381-a803-aed1d985c35d', 'Aplicación en vidrio (instalación)', 1, 25);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('401c2212-3206-4381-a803-aed1d985c35d', 'Corte a medida', 6),
  ('401c2212-3206-4381-a803-aed1d985c35d', 'Transporte y andamiaje', 15);

-- PRODUCTO: Melamine y Drywall
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  'c57c6ce9-ee71-4781-9b83-36940791b5b9',
  'PRD-2026-0005',
  'Melamine y Drywall',
  (SELECT id FROM categories WHERE name = 'Melamine & Drywall' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

DELETE FROM product_materials WHERE product_id = 'c57c6ce9-ee71-4781-9b83-36940791b5b9';
DELETE FROM product_labor WHERE product_id = 'c57c6ce9-ee71-4781-9b83-36940791b5b9';
DELETE FROM product_indirect_costs WHERE product_id = 'c57c6ce9-ee71-4781-9b83-36940791b5b9';

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ('c57c6ce9-ee71-4781-9b83-36940791b5b9', '2c69b837-cc59-4f74-81a0-c08b80c63817', 'Tablero melamine 18mm', 1, 140, 'm²'),
  ('c57c6ce9-ee71-4781-9b83-36940791b5b9', '233b69fc-ab0f-4db1-9dee-2dead10bf284', 'Cantos / tapacantos', 4, 1.2, 'm lineal'),
  ('c57c6ce9-ee71-4781-9b83-36940791b5b9', '2cc49349-1512-4b1e-a476-679bd1c60894', 'Herrajes (bisagras, correderas, jaladores)', 1, 40, 'juego');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('c57c6ce9-ee71-4781-9b83-36940791b5b9', 'Diseño y armado de mueble', 1, 20),
  ('c57c6ce9-ee71-4781-9b83-36940791b5b9', 'Carpintería / instalación', 1, 80),
  ('c57c6ce9-ee71-4781-9b83-36940791b5b9', 'Cortes y acabados', 1, 40);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('c57c6ce9-ee71-4781-9b83-36940791b5b9', 'Transporte', 20);

-- PRODUCTO: Publicidad Impresa
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  'be2c30c6-22bc-4d80-85c1-945aa84e6cc1',
  'PRD-2026-0006',
  'Publicidad Impresa',
  (SELECT id FROM categories WHERE name = 'Publicidad Impresa' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

DELETE FROM product_materials WHERE product_id = 'be2c30c6-22bc-4d80-85c1-945aa84e6cc1';
DELETE FROM product_labor WHERE product_id = 'be2c30c6-22bc-4d80-85c1-945aa84e6cc1';
DELETE FROM product_indirect_costs WHERE product_id = 'be2c30c6-22bc-4d80-85c1-945aa84e6cc1';

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ('be2c30c6-22bc-4d80-85c1-945aa84e6cc1', '57e49b27-a655-495c-b835-597df0f98b46', 'Lona / banner / mesh base', 1, 10, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('be2c30c6-22bc-4d80-85c1-945aa84e6cc1', 'Instalación', 1, 15);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('be2c30c6-22bc-4d80-85c1-945aa84e6cc1', 'Impresión digital gran formato', 5),
  ('be2c30c6-22bc-4d80-85c1-945aa84e6cc1', 'Acabados (ojales, dobladillos, bolsillos)', 5),
  ('be2c30c6-22bc-4d80-85c1-945aa84e6cc1', 'Transporte', 15);

-- PRODUCTO: Señalética y Letreros
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  '4a257f31-c254-4367-afde-f238f956105f',
  'PRD-2026-0007',
  'Señalética y Letreros',
  (SELECT id FROM categories WHERE name = 'Señaléticas y Letreros' LIMIT 1),
  'unidad',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

DELETE FROM product_materials WHERE product_id = '4a257f31-c254-4367-afde-f238f956105f';
DELETE FROM product_labor WHERE product_id = '4a257f31-c254-4367-afde-f238f956105f';
DELETE FROM product_indirect_costs WHERE product_id = '4a257f31-c254-4367-afde-f238f956105f';

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ('4a257f31-c254-4367-afde-f238f956105f', '0b32e806-4125-40c6-b6ee-f1fa3f066d7a', 'Acrílico / PVC', 1, 40, 'unidad'),
  ('4a257f31-c254-4367-afde-f238f956105f', 'ee90f199-d21a-49e8-8010-e9f988440548', 'Módulos LED e iluminación', 1, 25, 'unidad');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('4a257f31-c254-4367-afde-f238f956105f', 'Ensamblaje', 1, 20),
  ('4a257f31-c254-4367-afde-f238f956105f', 'Cableado e instalación eléctrica', 1, 15),
  ('4a257f31-c254-4367-afde-f238f956105f', 'Instalación en sitio', 1, 25);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('4a257f31-c254-4367-afde-f238f956105f', 'Corte láser / router CNC', 15),
  ('4a257f31-c254-4367-afde-f238f956105f', 'Transporte', 15);

-- PRODUCTO: Exhibidores y POP - M2
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  'cf98bfa9-b323-4999-9b31-b69f7e98f852',
  'PRD-2026-0008',
  'Exhibidores y POP - M2',
  (SELECT id FROM categories WHERE name = 'Exhibidores' LIMIT 1),
  'unidad',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

DELETE FROM product_materials WHERE product_id = 'cf98bfa9-b323-4999-9b31-b69f7e98f852';
DELETE FROM product_labor WHERE product_id = 'cf98bfa9-b323-4999-9b31-b69f7e98f852';
DELETE FROM product_indirect_costs WHERE product_id = 'cf98bfa9-b323-4999-9b31-b69f7e98f852';

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ('cf98bfa9-b323-4999-9b31-b69f7e98f852', '5d99baea-c9c6-4fc6-8f17-ecf64f4b003d', 'Acrílico / PVC / MDF', 1, 35, 'unidad'),
  ('cf98bfa9-b323-4999-9b31-b69f7e98f852', 'f93229c0-8f27-4df3-9ece-2de15da3ff61', 'Vinil laminado premium', 1, 30, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('cf98bfa9-b323-4999-9b31-b69f7e98f852', 'Ensamblaje', 1, 20);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('cf98bfa9-b323-4999-9b31-b69f7e98f852', 'Impresión gráfica del exhibidor', 15),
  ('cf98bfa9-b323-4999-9b31-b69f7e98f852', 'Corte y router', 20),
  ('cf98bfa9-b323-4999-9b31-b69f7e98f852', 'Instalación / entrega', 25);

-- PRODUCTO: Laminado Vehicular
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  '100ab346-7d71-4b31-b8a5-c765af28a6bc',
  'PRD-2026-0009',
  'Laminado Vehicular',
  (SELECT id FROM categories WHERE name = 'Laminado Vehicular' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

DELETE FROM product_materials WHERE product_id = '100ab346-7d71-4b31-b8a5-c765af28a6bc';
DELETE FROM product_labor WHERE product_id = '100ab346-7d71-4b31-b8a5-c765af28a6bc';
DELETE FROM product_indirect_costs WHERE product_id = '100ab346-7d71-4b31-b8a5-c765af28a6bc';

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ('100ab346-7d71-4b31-b8a5-c765af28a6bc', 'f93229c0-8f27-4df3-9ece-2de15da3ff61', 'Vinil laminado premium', 1, 50, 'm²'),
  ('100ab346-7d71-4b31-b8a5-c765af28a6bc', '04df005c-c061-4d26-ad38-1b17534ea93b', 'Laminado de protección de pintura', 1, 10, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('100ab346-7d71-4b31-b8a5-c765af28a6bc', 'Instalación especializada', 1, 60);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('100ab346-7d71-4b31-b8a5-c765af28a6bc', 'Diseño gráfico personalizado (prorrateado)', 18),
  ('100ab346-7d71-4b31-b8a5-c765af28a6bc', 'Impresión digital', 15),
  ('100ab346-7d71-4b31-b8a5-c765af28a6bc', 'Plotter de corte', 7),
  ('100ab346-7d71-4b31-b8a5-c765af28a6bc', 'Transporte', 20);

-- PRODUCTO: Instalación Profesional (servicio independiente)
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  'e37a5e4b-f8bf-42f6-994c-643c6a24b0ce',
  'PRD-2026-0010',
  'Instalación Profesional (servicio independiente)',
  (SELECT id FROM categories WHERE name = 'Instalación de Vinil Profesional' LIMIT 1),
  'servicio',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

DELETE FROM product_materials WHERE product_id = 'e37a5e4b-f8bf-42f6-994c-643c6a24b0ce';
DELETE FROM product_labor WHERE product_id = 'e37a5e4b-f8bf-42f6-994c-643c6a24b0ce';
DELETE FROM product_indirect_costs WHERE product_id = 'e37a5e4b-f8bf-42f6-994c-643c6a24b0ce';

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ('e37a5e4b-f8bf-42f6-994c-643c6a24b0ce', '7283748b-6645-4b2f-ac3a-52d6a7507977', 'Insumos menores de fijación (tornillos, silicona, cinta)', 1, 10, 'servicio');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('e37a5e4b-f8bf-42f6-994c-643c6a24b0ce', 'Técnico especializado', 1, 50);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('e37a5e4b-f8bf-42f6-994c-643c6a24b0ce', 'Herramientas y equipos', 20),
  ('e37a5e4b-f8bf-42f6-994c-643c6a24b0ce', 'Supervisión de obra', 20),
  ('e37a5e4b-f8bf-42f6-994c-643c6a24b0ce', 'Transporte a punto.', 20);

COMMIT;
