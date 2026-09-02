-- ============================================================
-- SEED: Insert products and cost structures from Excel
-- Auto-generated script
-- ============================================================

BEGIN;

-- MASTER MATERIALS
INSERT INTO materials (name, unit, cost) VALUES ('Vinil pizarra premium', 'm²', 0) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Laminado protector antirayas', 'm²', 0) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Vinil decorativo', 'm²', 38) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Adhesivo / pegamento especial', 'm²', 6) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Laminado protector', 'm²', 6) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Lámina de seguridad / control solar', 'm²', 55) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Tablero melamine 18mm', 'm²', 140) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Cantos / tapacantos', 'm lineal', 1.2) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Herrajes (bisagras, correderas, jaladores)', 'juego', 40) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Lona / banner / mesh base', 'm²', 10) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Acrílico / PVC', 'unidad', 40) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Módulos LED e iluminación', 'unidad', 25) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Acrílico / PVC / MDF', 'unidad', 35) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Vinil laminado premium', 'm²', 30) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Laminado de protección de pintura', 'm²', 10) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;
INSERT INTO materials (name, unit, cost) VALUES ('Insumos menores de fijación (tornillos, silicona, cinta)', 'servicio', 10) ON CONFLICT (name) DO UPDATE SET cost = EXCLUDED.cost, unit = EXCLUDED.unit;

-- PRODUCTO: Pizarras Adhesivas Premium Personalizadas
INSERT INTO products (code, name, category_id, unit, default_margin, is_active)
VALUES (
  'PRD-2026-0001',
  'Pizarras Adhesivas Premium Personalizadas',
  (SELECT id FROM categories WHERE name = 'Pizarras Adhesivas' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit, category_id = EXCLUDED.category_id;

DELETE FROM product_materials WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0001');
DELETE FROM product_labor WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0001');
DELETE FROM product_indirect_costs WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0001');

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0001'), (SELECT id FROM materials WHERE name = 'Vinil pizarra premium'), 'Vinil pizarra premium', 1, 0, 'm²'),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0001'), (SELECT id FROM materials WHERE name = 'Laminado protector antirayas'), 'Laminado protector antirayas', 1, 0, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0001'), 'Instalación especializada', 1, 0);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0001'), 'Impresión / corte digital', 0),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0001'), 'Diseño gráfico (prorrateado)', 0),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0001'), 'Transporte y logística', 0),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0001'), 'Empaque y protección', 0);

-- PRODUCTO: Revestimientos Adhesivos
INSERT INTO products (code, name, category_id, unit, default_margin, is_active)
VALUES (
  'PRD-2026-0002',
  'Revestimientos Adhesivos',
  (SELECT id FROM categories WHERE name = 'Revestimiento Adhesivos' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit, category_id = EXCLUDED.category_id;

DELETE FROM product_materials WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0002');
DELETE FROM product_labor WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0002');
DELETE FROM product_indirect_costs WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0002');

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0002'), (SELECT id FROM materials WHERE name = 'Vinil decorativo'), 'Vinil decorativo', 1, 38, 'm²'),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0002'), (SELECT id FROM materials WHERE name = 'Adhesivo / pegamento especial'), 'Adhesivo / pegamento especial', 1, 6, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0002'), 'Instalación', 1, 30);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0002'), 'Impresión digital (diseño personalizado)', 9),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0002'), 'Transporte', 15);

-- PRODUCTO: Vinilos Decorativos para Superficies
INSERT INTO products (code, name, category_id, unit, default_margin, is_active)
VALUES (
  'PRD-2026-0003',
  'Vinilos Decorativos para Superficies',
  (SELECT id FROM categories WHERE name = 'Vinil Decorativo' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit, category_id = EXCLUDED.category_id;

DELETE FROM product_materials WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0003');
DELETE FROM product_labor WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0003');
DELETE FROM product_indirect_costs WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0003');

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0003'), (SELECT id FROM materials WHERE name = 'Vinil decorativo'), 'Vinil decorativo', 1, 25, 'm²'),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0003'), (SELECT id FROM materials WHERE name = 'Laminado protector'), 'Laminado protector', 1, 6, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0003'), 'Instalación', 1, 15);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0003'), 'Impresión ecosolvente de alta', 10),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0003'), 'Plotter de corte', 6),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0003'), 'Transporte', 15);

-- PRODUCTO: Láminas para Vidrio
INSERT INTO products (code, name, category_id, unit, default_margin, is_active)
VALUES (
  'PRD-2026-0004',
  'Láminas para Vidrio',
  (SELECT id FROM categories WHERE name = 'Láminas de Vidrio' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit, category_id = EXCLUDED.category_id;

DELETE FROM product_materials WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0004');
DELETE FROM product_labor WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0004');
DELETE FROM product_indirect_costs WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0004');

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0004'), (SELECT id FROM materials WHERE name = 'Lámina de seguridad / control solar'), 'Lámina de seguridad / control solar', 1, 55, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0004'), 'Aplicación en vidrio (instalación)', 1, 25);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0004'), 'Corte a medida', 6),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0004'), 'Transporte y andamiaje', 15);

-- PRODUCTO: Melamine y Drywall
INSERT INTO products (code, name, category_id, unit, default_margin, is_active)
VALUES (
  'PRD-2026-0005',
  'Melamine y Drywall',
  (SELECT id FROM categories WHERE name = 'Melamine & Drywall' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit, category_id = EXCLUDED.category_id;

DELETE FROM product_materials WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0005');
DELETE FROM product_labor WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0005');
DELETE FROM product_indirect_costs WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0005');

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0005'), (SELECT id FROM materials WHERE name = 'Tablero melamine 18mm'), 'Tablero melamine 18mm', 1, 140, 'm²'),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0005'), (SELECT id FROM materials WHERE name = 'Cantos / tapacantos'), 'Cantos / tapacantos', 4, 1.2, 'm lineal'),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0005'), (SELECT id FROM materials WHERE name = 'Herrajes (bisagras, correderas, jaladores)'), 'Herrajes (bisagras, correderas, jaladores)', 1, 40, 'juego');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0005'), 'Diseño y armado de mueble', 1, 20),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0005'), 'Carpintería / instalación', 1, 80),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0005'), 'Cortes y acabados', 1, 40);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0005'), 'Transporte', 20);

-- PRODUCTO: Publicidad Impresa
INSERT INTO products (code, name, category_id, unit, default_margin, is_active)
VALUES (
  'PRD-2026-0006',
  'Publicidad Impresa',
  (SELECT id FROM categories WHERE name = 'Publicidad Impresa' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit, category_id = EXCLUDED.category_id;

DELETE FROM product_materials WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0006');
DELETE FROM product_labor WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0006');
DELETE FROM product_indirect_costs WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0006');

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0006'), (SELECT id FROM materials WHERE name = 'Lona / banner / mesh base'), 'Lona / banner / mesh base', 1, 10, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0006'), 'Instalación', 1, 15);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0006'), 'Impresión digital gran formato', 5),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0006'), 'Acabados (ojales, dobladillos, bolsillos)', 5),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0006'), 'Transporte', 15);

-- PRODUCTO: Señalética y Letreros
INSERT INTO products (code, name, category_id, unit, default_margin, is_active)
VALUES (
  'PRD-2026-0007',
  'Señalética y Letreros',
  (SELECT id FROM categories WHERE name = 'Señaléticas y Letreros' LIMIT 1),
  'unidad',
  35,
  true
) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit, category_id = EXCLUDED.category_id;

DELETE FROM product_materials WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0007');
DELETE FROM product_labor WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0007');
DELETE FROM product_indirect_costs WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0007');

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0007'), (SELECT id FROM materials WHERE name = 'Acrílico / PVC'), 'Acrílico / PVC', 1, 40, 'unidad'),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0007'), (SELECT id FROM materials WHERE name = 'Módulos LED e iluminación'), 'Módulos LED e iluminación', 1, 25, 'unidad');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0007'), 'Ensamblaje', 1, 20),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0007'), 'Cableado e instalación eléctrica', 1, 15),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0007'), 'Instalación en sitio', 1, 25);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0007'), 'Corte láser / router CNC', 15),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0007'), 'Transporte', 15);

-- PRODUCTO: Exhibidores y POP - M2
INSERT INTO products (code, name, category_id, unit, default_margin, is_active)
VALUES (
  'PRD-2026-0008',
  'Exhibidores y POP - M2',
  (SELECT id FROM categories WHERE name = 'Exhibidores' LIMIT 1),
  'unidad',
  35,
  true
) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit, category_id = EXCLUDED.category_id;

DELETE FROM product_materials WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0008');
DELETE FROM product_labor WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0008');
DELETE FROM product_indirect_costs WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0008');

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0008'), (SELECT id FROM materials WHERE name = 'Acrílico / PVC / MDF'), 'Acrílico / PVC / MDF', 1, 35, 'unidad'),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0008'), (SELECT id FROM materials WHERE name = 'Vinil laminado premium'), 'Vinil laminado premium', 1, 30, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0008'), 'Ensamblaje', 1, 20);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0008'), 'Impresión gráfica del exhibidor', 15),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0008'), 'Corte y router', 20),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0008'), 'Instalación / entrega', 25);

-- PRODUCTO: Laminado Vehicular
INSERT INTO products (code, name, category_id, unit, default_margin, is_active)
VALUES (
  'PRD-2026-0009',
  'Laminado Vehicular',
  (SELECT id FROM categories WHERE name = 'Laminado Vehicular' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit, category_id = EXCLUDED.category_id;

DELETE FROM product_materials WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0009');
DELETE FROM product_labor WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0009');
DELETE FROM product_indirect_costs WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0009');

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0009'), (SELECT id FROM materials WHERE name = 'Vinil laminado premium'), 'Vinil laminado premium', 1, 50, 'm²'),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0009'), (SELECT id FROM materials WHERE name = 'Laminado de protección de pintura'), 'Laminado de protección de pintura', 1, 10, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0009'), 'Instalación especializada', 1, 60);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0009'), 'Diseño gráfico personalizado (prorrateado)', 18),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0009'), 'Impresión digital', 15),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0009'), 'Plotter de corte', 7),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0009'), 'Transporte', 20);

-- PRODUCTO: Instalación Profesional (servicio independiente)
INSERT INTO products (code, name, category_id, unit, default_margin, is_active)
VALUES (
  'PRD-2026-0010',
  'Instalación Profesional (servicio independiente)',
  (SELECT id FROM categories WHERE name = 'Instalación de Vinil Profesional' LIMIT 1),
  'servicio',
  35,
  true
) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit, category_id = EXCLUDED.category_id;

DELETE FROM product_materials WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0010');
DELETE FROM product_labor WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0010');
DELETE FROM product_indirect_costs WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-2026-0010');

INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0010'), (SELECT id FROM materials WHERE name = 'Insumos menores de fijación (tornillos, silicona, cinta)'), 'Insumos menores de fijación (tornillos, silicona, cinta)', 1, 10, 'servicio');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0010'), 'Técnico especializado', 1, 50);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ((SELECT id FROM products WHERE code = 'PRD-2026-0010'), 'Herramientas y equipos', 20),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0010'), 'Supervisión de obra', 20),
  ((SELECT id FROM products WHERE code = 'PRD-2026-0010'), 'Transporte a punto.', 20);

COMMIT;
