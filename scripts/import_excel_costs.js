const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EXCEL_PATH = 'd:/proyectos/galeria/galeria/Costos por Producto y Servicio.xlsx';
const OUTPUT_PATH = path.join(__dirname, '../supabase/seed_products.sql');

function parseCurrency(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  return parseFloat(str.replace(/[^0-9.-]+/g, ''));
}

const CATEGORY_MAP = {
  'Pizarras Adhesivas Premium Personalizadas': 'Pizarras Adhesivas',
  'Revestimientos Adhesivos': 'Revestimiento Adhesivos',
  'Vinilos Decorativos para Superficies': 'Vinil Decorativo',
  'Láminas para Vidrio': 'Láminas de Vidrio',
  'Melamine y Drywall': 'Melamine & Drywall',
  'Publicidad Impresa': 'Publicidad Impresa',
  'Señalética y Letreros': 'Señaléticas y Letreros',
  'Exhibidores y POP - M2': 'Exhibidores',
  'Laminado Vehicular': 'Laminado Vehicular',
  'Instalación Profesional (servicio independiente)': 'Instalación de Vinil Profesional'
};

function main() {
  console.log('Reading Excel file...');
  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheetName = 'Estructura de Costos';
  const worksheet = workbook.Sheets[sheetName];
  
  if (!worksheet) {
    console.error(`Sheet "${sheetName}" not found!`);
    return;
  }

  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  const products = [];
  const uniqueMaterials = new Map();
  let currentProduct = null;
  let codeCounter = 1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Skip empty rows or title rows
    if (row.length === 0) continue;
    if (row[0] === 'Estructura de Costos por Producto / Servicio — LAMINARTE') continue;
    if (typeof row[0] === 'string' && row[0].startsWith('Valores de referencia')) continue;
    if (row[0] === 'Producto / Servicio') continue; // Header row

    const col0 = row[0]; // Product Name
    const col1 = row[1]; // Unidad de referencia
    const col2 = row[2]; // Categoría de Costo
    const col3 = row[3]; // Ítem
    const col4 = row[4]; // Unidad
    const col5 = row[5]; // Costo Unitario
    const col6 = row[6]; // Cantidad
    
    // If we have a product name in the first column, start a new product
    if (col0 && typeof col0 === 'string' && col0.trim() !== '') {
      currentProduct = {
        id: crypto.randomUUID(),
        code: `PRD-2026-${String(codeCounter++).padStart(4, '0')}`,
        name: col0.trim(),
        unit: 'unidad', // Default, will update based on col1
        materials: [],
        labor: [],
        indirects: []
      };
      products.push(currentProduct);
    } 
    // If it's an item row for the current product
    else if (currentProduct && col2 && typeof col2 === 'string') {
      const cat = col2.trim();
      
      // Update product unit from col1 if not already set intelligently
      if (col1 && typeof col1 === 'string') {
        if (col1.includes('m²')) currentProduct.unit = 'm²';
        else if (col1.includes('unidad')) currentProduct.unit = 'unidad';
        else if (col1.includes('hora')) currentProduct.unit = 'servicio';
      }

      const itemDesc = (col3 || '').toString().trim();
      const itemUnit = (col4 || 'unidad').toString().trim();
      const unitCost = parseCurrency(col5);
      const quantity = parseFloat(col6) || 1;

      if (cat.includes('Materiales') || cat.includes('Insumos')) {
        let matId;
        const matKey = itemDesc.toLowerCase();
        if (uniqueMaterials.has(matKey)) {
           matId = uniqueMaterials.get(matKey).id;
        } else {
           matId = crypto.randomUUID();
           uniqueMaterials.set(matKey, {
             id: matId,
             name: itemDesc,
             unit: itemUnit,
             cost: unitCost
           });
        }
        currentProduct.materials.push({
          material_id: matId,
          name: itemDesc,
          quantity: quantity,
          unit_cost: unitCost,
          unit: itemUnit
        });
      } else if (cat.includes('Mano de Obra') || cat.includes('Servicio') && !cat.includes('Otros')) {
        // Map to labor
        currentProduct.labor.push({
          work_type: itemDesc,
          hours: quantity,
          hourly_rate: unitCost
        });
      } else if (cat.includes('Producción') || cat.includes('Otros')) {
        // Map to indirect costs
        const total = quantity * unitCost;
        currentProduct.indirects.push({
          concept: itemDesc + (quantity !== 1 ? ` (${quantity} ${itemUnit})` : ''),
          cost: total
        });
      }
    }
  }

  console.log(`Parsed ${products.length} products.`);

  // Generate SQL
  let sql = `-- ============================================================\n`;
  sql += `-- SEED: Insert products and cost structures from Excel\n`;
  sql += `-- Auto-generated script\n`;
  sql += `-- ============================================================\n\n`;
  sql += `BEGIN;\n\n`;

  sql += `-- MASTER MATERIALS\n`;
  for (const m of uniqueMaterials.values()) {
    sql += `INSERT INTO materials (id, name, unit, cost) VALUES ('${m.id}', '${m.name.replace(/'/g, "''")}', '${m.unit.replace(/'/g, "''")}', ${m.cost}) ON CONFLICT (name) DO NOTHING;\n`;
  }
  sql += `\n`;

  for (const p of products) {
    const catName = CATEGORY_MAP[p.name] || 'General';
    const margin = 35.00; // From "Resumen de Precios"

    sql += `-- PRODUCTO: ${p.name}\n`;
    sql += `INSERT INTO products (id, code, name, category_id, unit, default_margin, is_active)\n`;
    sql += `VALUES (\n`;
    sql += `  '${p.id}',\n`;
    sql += `  '${p.code}',\n`;
    sql += `  '${p.name}',\n`;
    sql += `  (SELECT id FROM categories WHERE name = '${catName}' LIMIT 1),\n`;
    sql += `  '${p.unit}',\n`;
    sql += `  ${margin},\n`;
    sql += `  true\n`;
    sql += `) ON CONFLICT (code) DO NOTHING;\n\n`;

    // Clear existing relations to allow updates
    sql += `DELETE FROM product_materials WHERE product_id = '${p.id}';\n`;
    sql += `DELETE FROM product_labor WHERE product_id = '${p.id}';\n`;
    sql += `DELETE FROM product_indirect_costs WHERE product_id = '${p.id}';\n\n`;

    // Materials
    if (p.materials.length > 0) {
      sql += `INSERT INTO product_materials (product_id, material_id, name, quantity, unit_cost, unit) VALUES\n`;
      const matValues = p.materials.map(m => 
        `  ('${p.id}', '${m.material_id}', '${m.name.replace(/'/g, "''")}', ${m.quantity}, ${m.unit_cost}, '${m.unit.replace(/'/g, "''")}')`
      );
      sql += matValues.join(',\n') + `;\n\n`;
    }

    // Labor
    if (p.labor.length > 0) {
      sql += `INSERT INTO product_labor (product_id, work_type, hours, hourly_rate) VALUES\n`;
      const labValues = p.labor.map(l => 
        `  ('${p.id}', '${l.work_type.replace(/'/g, "''")}', ${l.hours}, ${l.hourly_rate})`
      );
      sql += labValues.join(',\n') + `;\n\n`;
    }

    // Indirects
    if (p.indirects.length > 0) {
      sql += `INSERT INTO product_indirect_costs (product_id, concept, cost) VALUES\n`;
      const indValues = p.indirects.map(i => 
        `  ('${p.id}', '${i.concept.replace(/'/g, "''")}', ${i.cost})`
      );
      sql += indValues.join(',\n') + `;\n\n`;
    }
  }

  sql += `COMMIT;\n`;

  fs.writeFileSync(OUTPUT_PATH, sql, 'utf8');
  console.log(`Successfully generated SQL seed file: ${OUTPUT_PATH}`);
}

main();
