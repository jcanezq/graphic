-- ============================================================
-- SEED: Insert products and cost structures from Excel
-- Auto-generated script
-- ============================================================

BEGIN;

-- PRODUCTO: Pizarras Adhesivas Premium Personalizadas
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  '3f0aca88-6549-419f-885f-b5aba49150fa',
  'PRD-2026-0001',
  'Pizarras Adhesivas Premium Personalizadas',
  (SELECT id FROM categories WHERE name = 'Pizarras Adhesivas' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

INSERT INTO product_materials (product_id, name, quantity, unit_cost, unit) VALUES
  ('3f0aca88-6549-419f-885f-b5aba49150fa', 'Vinil pizarra premium', 1, 0, 'm²'),
  ('3f0aca88-6549-419f-885f-b5aba49150fa', 'Laminado protector antirayas', 1, 0, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('3f0aca88-6549-419f-885f-b5aba49150fa', 'Instalación especializada', 1, 0);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('3f0aca88-6549-419f-885f-b5aba49150fa', 'Impresión / corte digital', 0),
  ('3f0aca88-6549-419f-885f-b5aba49150fa', 'Diseño gráfico (prorrateado)', 0),
  ('3f0aca88-6549-419f-885f-b5aba49150fa', 'Transporte y logística', 0),
  ('3f0aca88-6549-419f-885f-b5aba49150fa', 'Empaque y protección', 0);

-- PRODUCTO: Revestimientos Adhesivos
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  'e5f359f6-f5b5-4f38-a2b1-852dcba7d7f2',
  'PRD-2026-0002',
  'Revestimientos Adhesivos',
  (SELECT id FROM categories WHERE name = 'Revestimiento Adhesivos' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

INSERT INTO product_materials (product_id, name, quantity, unit_cost, unit) VALUES
  ('e5f359f6-f5b5-4f38-a2b1-852dcba7d7f2', 'Vinil decorativo', 1, 38, 'm²'),
  ('e5f359f6-f5b5-4f38-a2b1-852dcba7d7f2', 'Adhesivo / pegamento especial', 1, 6, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('e5f359f6-f5b5-4f38-a2b1-852dcba7d7f2', 'Instalación', 1, 30);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('e5f359f6-f5b5-4f38-a2b1-852dcba7d7f2', 'Impresión digital (diseño personalizado)', 9),
  ('e5f359f6-f5b5-4f38-a2b1-852dcba7d7f2', 'Transporte', 15);

-- PRODUCTO: Vinilos Decorativos para Superficies
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  '330c5384-067e-41a3-9764-a3bf4af2517c',
  'PRD-2026-0003',
  'Vinilos Decorativos para Superficies',
  (SELECT id FROM categories WHERE name = 'Vinil Decorativo' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

INSERT INTO product_materials (product_id, name, quantity, unit_cost, unit) VALUES
  ('330c5384-067e-41a3-9764-a3bf4af2517c', 'Vinil decorativo', 1, 25, 'm²'),
  ('330c5384-067e-41a3-9764-a3bf4af2517c', 'Laminado protector', 1, 6, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('330c5384-067e-41a3-9764-a3bf4af2517c', 'Instalación', 1, 15);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('330c5384-067e-41a3-9764-a3bf4af2517c', 'Impresión ecosolvente de alta', 10),
  ('330c5384-067e-41a3-9764-a3bf4af2517c', 'Plotter de corte', 6),
  ('330c5384-067e-41a3-9764-a3bf4af2517c', 'Transporte', 15);

-- PRODUCTO: Láminas para Vidrio
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  'ccdb1930-2007-4513-b7e3-49457fe22c12',
  'PRD-2026-0004',
  'Láminas para Vidrio',
  (SELECT id FROM categories WHERE name = 'Láminas de Vidrio' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

INSERT INTO product_materials (product_id, name, quantity, unit_cost, unit) VALUES
  ('ccdb1930-2007-4513-b7e3-49457fe22c12', 'Lámina de seguridad / control solar', 1, 55, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('ccdb1930-2007-4513-b7e3-49457fe22c12', 'Aplicación en vidrio (instalación)', 1, 25);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('ccdb1930-2007-4513-b7e3-49457fe22c12', 'Corte a medida', 6),
  ('ccdb1930-2007-4513-b7e3-49457fe22c12', 'Transporte y andamiaje', 15);

-- PRODUCTO: Melamine y Drywall
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  'da8459f4-8594-489e-aa92-5ab045c00548',
  'PRD-2026-0005',
  'Melamine y Drywall',
  (SELECT id FROM categories WHERE name = 'Melamine & Drywall' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

INSERT INTO product_materials (product_id, name, quantity, unit_cost, unit) VALUES
  ('da8459f4-8594-489e-aa92-5ab045c00548', 'Tablero melamine 18mm', 1, 140, 'm²'),
  ('da8459f4-8594-489e-aa92-5ab045c00548', 'Cantos / tapacantos', 4, 1.2, 'm lineal'),
  ('da8459f4-8594-489e-aa92-5ab045c00548', 'Herrajes (bisagras, correderas, jaladores)', 1, 40, 'juego');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('da8459f4-8594-489e-aa92-5ab045c00548', 'Diseño y armado de mueble', 1, 20),
  ('da8459f4-8594-489e-aa92-5ab045c00548', 'Carpintería / instalación', 1, 80),
  ('da8459f4-8594-489e-aa92-5ab045c00548', 'Cortes y acabados', 1, 40);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('da8459f4-8594-489e-aa92-5ab045c00548', 'Transporte', 20);

-- PRODUCTO: Publicidad Impresa
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  'bfacb472-0b5d-45bb-8c1b-f739623e06f2',
  'PRD-2026-0006',
  'Publicidad Impresa',
  (SELECT id FROM categories WHERE name = 'Publicidad Impresa' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

INSERT INTO product_materials (product_id, name, quantity, unit_cost, unit) VALUES
  ('bfacb472-0b5d-45bb-8c1b-f739623e06f2', 'Lona / banner / mesh base', 1, 10, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('bfacb472-0b5d-45bb-8c1b-f739623e06f2', 'Instalación', 1, 15);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('bfacb472-0b5d-45bb-8c1b-f739623e06f2', 'Impresión digital gran formato', 5),
  ('bfacb472-0b5d-45bb-8c1b-f739623e06f2', 'Acabados (ojales, dobladillos, bolsillos)', 5),
  ('bfacb472-0b5d-45bb-8c1b-f739623e06f2', 'Transporte', 15);

-- PRODUCTO: Señalética y Letreros
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  '1142021b-a311-4d5e-87b1-b7ee49a9739e',
  'PRD-2026-0007',
  'Señalética y Letreros',
  (SELECT id FROM categories WHERE name = 'Señaléticas y Letreros' LIMIT 1),
  'unidad',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

INSERT INTO product_materials (product_id, name, quantity, unit_cost, unit) VALUES
  ('1142021b-a311-4d5e-87b1-b7ee49a9739e', 'Acrílico / PVC', 1, 40, 'unidad'),
  ('1142021b-a311-4d5e-87b1-b7ee49a9739e', 'Módulos LED e iluminación', 1, 25, 'unidad');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('1142021b-a311-4d5e-87b1-b7ee49a9739e', 'Ensamblaje', 1, 20),
  ('1142021b-a311-4d5e-87b1-b7ee49a9739e', 'Cableado e instalación eléctrica', 1, 15),
  ('1142021b-a311-4d5e-87b1-b7ee49a9739e', 'Instalación en sitio', 1, 25);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('1142021b-a311-4d5e-87b1-b7ee49a9739e', 'Corte láser / router CNC', 15),
  ('1142021b-a311-4d5e-87b1-b7ee49a9739e', 'Transporte', 15);

-- PRODUCTO: Exhibidores y POP - M2
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  '5d98bfcc-65e1-4fb9-a92f-76261d4dea30',
  'PRD-2026-0008',
  'Exhibidores y POP - M2',
  (SELECT id FROM categories WHERE name = 'Exhibidores' LIMIT 1),
  'unidad',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

INSERT INTO product_materials (product_id, name, quantity, unit_cost, unit) VALUES
  ('5d98bfcc-65e1-4fb9-a92f-76261d4dea30', 'Acrílico / PVC / MDF', 1, 35, 'unidad'),
  ('5d98bfcc-65e1-4fb9-a92f-76261d4dea30', 'Vinil laminado premium', 1, 30, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('5d98bfcc-65e1-4fb9-a92f-76261d4dea30', 'Ensamblaje', 1, 20);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('5d98bfcc-65e1-4fb9-a92f-76261d4dea30', 'Impresión gráfica del exhibidor', 15),
  ('5d98bfcc-65e1-4fb9-a92f-76261d4dea30', 'Corte y router', 20),
  ('5d98bfcc-65e1-4fb9-a92f-76261d4dea30', 'Instalación / entrega', 25);

-- PRODUCTO: Laminado Vehicular
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  '0f413b87-e5f2-4913-b942-7b9fa9d8e52a',
  'PRD-2026-0009',
  'Laminado Vehicular',
  (SELECT id FROM categories WHERE name = 'Laminado Vehicular' LIMIT 1),
  'm²',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

INSERT INTO product_materials (product_id, name, quantity, unit_cost, unit) VALUES
  ('0f413b87-e5f2-4913-b942-7b9fa9d8e52a', 'Vinil laminado premium', 1, 50, 'm²'),
  ('0f413b87-e5f2-4913-b942-7b9fa9d8e52a', 'Laminado de protección de pintura', 1, 10, 'm²');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('0f413b87-e5f2-4913-b942-7b9fa9d8e52a', 'Instalación especializada', 1, 60);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('0f413b87-e5f2-4913-b942-7b9fa9d8e52a', 'Diseño gráfico personalizado (prorrateado)', 18),
  ('0f413b87-e5f2-4913-b942-7b9fa9d8e52a', 'Impresión digital', 15),
  ('0f413b87-e5f2-4913-b942-7b9fa9d8e52a', 'Plotter de corte', 7),
  ('0f413b87-e5f2-4913-b942-7b9fa9d8e52a', 'Transporte', 20);

-- PRODUCTO: Instalación Profesional (servicio independiente)
INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)
VALUES (
  'b94f9855-dcd3-49e4-abce-80d35f1a1bad',
  'PRD-2026-0010',
  'Instalación Profesional (servicio independiente)',
  (SELECT id FROM categories WHERE name = 'Instalación de Vinil Profesional' LIMIT 1),
  'servicio',
  35,
  true
) ON CONFLICT (code) DO NOTHING;

INSERT INTO product_materials (product_id, name, quantity, unit_cost, unit) VALUES
  ('b94f9855-dcd3-49e4-abce-80d35f1a1bad', 'Insumos menores de fijación (tornillos, silicona, cinta)', 1, 10, 'servicio');

INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES
  ('b94f9855-dcd3-49e4-abce-80d35f1a1bad', 'Técnico especializado', 1, 50);

INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES
  ('b94f9855-dcd3-49e4-abce-80d35f1a1bad', 'Herramientas y equipos', 20),
  ('b94f9855-dcd3-49e4-abce-80d35f1a1bad', 'Supervisión de obra', 20),
  ('b94f9855-dcd3-49e4-abce-80d35f1a1bad', 'Transporte a punto.', 20);

COMMIT;
