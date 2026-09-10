import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// El libro de costos ya no vive en el repo (contiene márgenes internos).
// Definir COSTS_XLSX_PATH en .env.local apuntando a la copia local.
const EXCEL_PATH = process.env.COSTS_XLSX_PATH as string;
if (!EXCEL_PATH) {
  console.error(
    "Falta COSTS_XLSX_PATH: ruta al libro de costos, que ya no se versiona en el repo."
  );
  process.exit(1);
}

function parseCurrency(str: any): number {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  return parseFloat(str.replace(/[^0-9.-]+/g, ''));
}

async function main() {
  console.log('Reading Excel file...');
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`Excel file not found at ${EXCEL_PATH}`);
    return;
  }
  
  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0]; // 'Estructura de Costos'
  const worksheet = workbook.Sheets[sheetName];
  
  const rows: any[] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  const products: any[] = [];
  const uniqueMaterials = new Map();
  let currentProduct: any = null;
  let codeCounter = 500; // start at a high number to avoid conflicts if needed, but we will delete old ones

  // We map by categories assuming there's a category called 'Servicios' or similar. 
  // For now, we will assign them to the first category if we don't know, or create a 'Servicios' category.
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Skip empty rows or title rows
    if (row.length === 0) continue;
    if (typeof row[0] === 'string' && row[0].includes('Estructura de Costos')) continue;
    if (typeof row[0] === 'string' && row[0].startsWith('Valores de referencia')) continue;
    if (row[0] === 'Producto / Servicio') continue;

    const col0 = row[0]; // Product Name
    const col1 = row[1]; // Unidad de referencia
    const col2 = row[2]; // Ítem
    const col3 = row[3]; // Categoría
    const col4 = row[4]; // Unidad
    const col5 = row[5]; // Costo Unitario
    const col6 = row[6]; // Cantidad
    
    // If we have a product name in the first column, start a new product
    if (col0 && typeof col0 === 'string' && col0.trim() !== '') {
      currentProduct = {
        code: `SRV-2026-${String(codeCounter++).padStart(4, '0')}`,
        name: col0.trim(),
        unit: 'servicio', 
        type: 'Servicio',
        materials: [],
        labor: [],
        indirects: []
      };
      // Try to parse unit from col1 if it exists
      if (col1 && typeof col1 === 'string') {
        if (col1.toLowerCase().includes('m²')) currentProduct.unit = 'm²';
        else if (col1.toLowerCase().includes('unidad')) currentProduct.unit = 'unidad';
        else if (col1.toLowerCase().includes('hora')) currentProduct.unit = 'hora-técnico / visita';
      }
      products.push(currentProduct);
    } 
    // If it's an item row for the current product
    else if (currentProduct && col3 && typeof col3 === 'string') {
      const cat = col3.trim();
      const itemDesc = (col2 || '').toString().trim();
      const itemUnit = (col4 || 'unidad').toString().trim();
      const unitCost = parseCurrency(col5);
      const quantity = parseFloat(col6) || 1;

      if (cat.includes('Materiales') || cat.includes('Insumos')) {
        const matKey = itemDesc.toLowerCase();
        if (!uniqueMaterials.has(matKey)) {
           uniqueMaterials.set(matKey, {
             name: itemDesc,
             unit: itemUnit,
             cost: unitCost
           });
        }
        currentProduct.materials.push({
          name: itemDesc,
          quantity: quantity,
          unit_cost: unitCost,
          unit: itemUnit
        });
      } else if (cat.includes('Mano de Obra') || cat.includes('Servicio') && !cat.includes('Otros') && !cat.includes('Diseño') && !itemDesc.toLowerCase().includes('diseño')) {
        currentProduct.labor.push({
          work_type: itemDesc,
          hours: quantity,
          hourly_rate: unitCost
        });
      } else {
        // Anything else goes to indirects (including Diseño and Transporte)
        const total = quantity * unitCost;
        currentProduct.indirects.push({
          concept: itemDesc + (quantity !== 1 ? ` (${quantity} ${itemUnit})` : ''),
          cost: total
        });
      }
    }
  }

  console.log(`Parsed ${products.length} services from Excel.`);

  // 1. Get Categories
  const { data: categories } = await supabase.from('categories').select('id, name');
  let categoryId = categories && categories.length > 0 ? categories[0].id : null;
  const srvCat = categories?.find(c => c.name.toLowerCase().includes('servicio'));
  if (srvCat) categoryId = srvCat.id;

  // 2. Delete existing services (and their relations via cascade, if configured. We'll delete relations just in case)
  console.log('Deleting existing services...');
  const { data: existingServices } = await supabase.from('products').select('id').eq('type', 'Servicio');
  if (existingServices && existingServices.length > 0) {
    const serviceIds = existingServices.map(s => s.id);
    await supabase.from('product_materials').delete().in('product_id', serviceIds);
    await supabase.from('product_labor').delete().in('product_id', serviceIds);
    await supabase.from('product_indirect_costs').delete().in('product_id', serviceIds);
    await supabase.from('products').delete().eq('type', 'Servicio');
  }

  // 3. Upsert Materials
  console.log('Upserting materials...');
  for (const m of Array.from(uniqueMaterials.values())) {
    // Check if exists
    const { data: existingMat } = await supabase.from('materials').select('id').eq('name', m.name).maybeSingle();
    if (!existingMat) {
        await supabase.from('materials').insert({ name: m.name, unit: m.unit, cost: m.cost });
    } else {
        await supabase.from('materials').update({ cost: m.cost, unit: m.unit }).eq('id', existingMat.id);
    }
  }
  
  const { data: dbMaterials } = await supabase.from('materials').select('id, name');
  const matMap = new Map();
  if (dbMaterials) {
      dbMaterials.forEach(m => matMap.set(m.name.toLowerCase(), m.id));
  }

  // 4. Insert new products and relations
  console.log('Inserting new services...');
  for (const p of products) {
    const { data: newProd, error: prodErr } = await supabase.from('products').insert({
      code: p.code,
      name: p.name,
      category_id: categoryId,
      unit: p.unit,
      type: 'Servicio',
      default_margin: 35.0,
      is_active: true
    }).select('id').single();

    if (prodErr) {
        console.error('Error inserting product', p.name, prodErr);
        continue;
    }

    const prodId = newProd.id;

    if (p.materials.length > 0) {
        const matsToInsert = p.materials.map((m: any) => ({
            product_id: prodId,
            material_id: matMap.get(m.name.toLowerCase()) || null,
            name: m.name,
            quantity: m.quantity,
            unit_cost: m.unit_cost,
            unit: m.unit
        }));
        await supabase.from('product_materials').insert(matsToInsert);
    }

    if (p.labor.length > 0) {
        const laborToInsert = p.labor.map((l: any) => ({
            product_id: prodId,
            work_type: l.work_type,
            hours: l.hours,
            hourly_rate: l.hourly_rate
        }));
        await supabase.from('product_labor').insert(laborToInsert);
    }

    if (p.indirects.length > 0) {
        const indToInsert = p.indirects.map((i: any) => ({
            product_id: prodId,
            concept: i.concept,
            cost: i.cost
        }));
        await supabase.from('product_indirect_costs').insert(indToInsert);
    }
  }

  console.log('Successfully imported services!');
}

main().catch(console.error);
