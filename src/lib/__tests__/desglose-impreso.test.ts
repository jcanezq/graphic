// ============================================================
// SUBC-T4 · El documento que sale tiene que decir lo mismo que la pantalla
//
// EL DEFECTO, hermano del de SUBC-T3. `buildQuotationItemLines` decide el
// desglose mirando `_components`: con receta imprime la receta, sin receta cae
// al motor legado. `/api/pdf/[id]` y `/api/quotations/[id]/email` leen
// `quotation_items(*)` y NADA de `quotation_item_components`, así que para ellas
// ninguna cotización tiene receta: imprimen legado siempre, incluso las que
// nacieron bien.
//
// Con todo incluido la plata coincide de casualidad (el motor legado suma lo
// mismo por otro camino) y por eso pasa desapercibido. Donde se ve es en el
// interruptor: un subcomponente que el cliente destildó vive en la receta, así
// que el PDF que no la carga se lo vuelve a cobrar — y el PDF es justamente lo
// que el cliente recibe.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createQuotationItemFromProduct, buildQuotationItemLines } from '@/lib/calculations';
import { attachComponents, withComponents, mapComponentRow } from '@/lib/quotation-components';
import { toQuotationItemComponentRows } from '@/lib/quotation-item-row';
import type { QuotationItemComponent } from '@/lib/pricing';

/** «Exhibidores y POP - M2» (SRV-2026-0507). Costo 145.00, margen 35 % -> 195.75. */
const EXHIBIDOR: any = {
  id: 'p-507', code: 'SRV-2026-0507', name: 'Exhibidores y POP - M2',
  type: 'Servicio', unit: 'm2', description: '', manual_unit_cost: null,
  default_margin: 35, is_active: true, category_id: null, image_url: null,
  materials: [
    { name: 'Acrilico', quantity: 1, unit_cost: 35, unit: 'm2', material_id: null },
    { name: 'Vinil',    quantity: 1, unit_cost: 30, unit: 'm2', material_id: null },
  ],
  labor: [{ work_type: 'Ensamblaje', hours: 1, hourly_rate: 20, unit: 'hr' }],
  indirect_costs: [
    { concept: 'Corte y router',      kind: 'production', unit: 'm2',     quantity: 1, unit_cost: 20, cost: 20 },
    { concept: 'Impresion grafica',   kind: 'production', unit: 'm2',     quantity: 1, unit_cost: 15, cost: 15 },
    { concept: 'Instalacion/entrega', kind: 'other',      unit: 'global', quantity: 1, unit_cost: 25, cost: 25 },
  ],
};

const suma = (item: any) =>
  Math.round(buildQuotationItemLines(item).reduce((s, l) => s + l.subtotal, 0) * 100) / 100;

/** Filas de `quotation_item_components` tal como vuelven de la base. */
function filasGuardadas(item: any, itemId: string, apagar?: string) {
  return toQuotationItemComponentRows(
    {
      ...item,
      _components: (item._components as QuotationItemComponent[]).map((c) =>
        c.label === apagar ? { ...c, is_included: false } : c),
    },
    itemId,
  ).map((f, i) => ({ ...f, id: `qic-${i}` }));
}

describe('SUBC-T4 — quien imprime un desglose carga la receta', () => {

  const rutasQueImprimen = [
    'src/app/api/pdf/[id]/route.ts',
    'src/app/api/quotations/[id]/email/route.ts',
  ];

  it.each(rutasQueImprimen)('%s carga la receta antes de armar el documento', (ruta) => {
    const fuente = readFileSync(join(process.cwd(), ruta), 'utf8');
    expect(fuente).toContain('withComponents');
  });

  it('el desglose del documento es el MISMO que el de la pantalla', async () => {
    const item: any = createQuotationItemFromProduct(EXHIBIDOR, 3, 35, 0);
    const enPantalla = buildQuotationItemLines(item);

    // Lo que hace la ruta: lee la fila del ítem (sin `_components`) y le cuelga
    // la receta guardada.
    const filaDelItem = { id: 'qi-1', ...item, _components: undefined };
    const [delDocumento] = attachComponents([filaDelItem], filasGuardadas(item, 'qi-1'));

    expect(buildQuotationItemLines(delDocumento)).toEqual(enPantalla);
  });

  it('un subcomponente destildado NO puede reaparecer en el PDF', async () => {
    const item: any = createQuotationItemFromProduct(EXHIBIDOR, 1, 35, 0);
    const filas = filasGuardadas(item, 'qi-1', 'Instalacion/entrega');

    const supabaseFalso = {
      from: () => {
        const q: any = {
          select: () => q,
          in: () => q,
          then: (r: (x: any) => void) => r({ data: filas, error: null }),
        };
        return q;
      },
    };

    const sinReceta = { id: 'qi-1', ...item, _components: undefined };
    const [conReceta] = await withComponents(supabaseFalso, [sinReceta]);

    expect(suma(conReceta)).toBe(162.00);   // lo que el cliente aceptó
    expect(suma(sinReceta)).toBe(195.75);   // lo que imprimía el PDF: 33.75 de más
  });

  it('una cotización sin receta guardada sigue imprimiendo por el motor legado', async () => {
    const legado: any = {
      id: 'qi-9', product_name: 'Banner viejo', unit: 'u', quantity: 2, unit_cost: 100,
      margin_percent: 30, has_labor: true, labor_quantity: 1, labor_unit_cost: 20,
      labor_margin_percent: 30, labor_scope: 'order', has_design: false, has_transport: false,
    };
    const [conCarga] = attachComponents([legado], []);
    expect(conCarga._components).toEqual([]);
    expect(buildQuotationItemLines(conCarga)).toEqual(buildQuotationItemLines(legado));
  });

  it('los números que vuelven como texto de la base se normalizan', () => {
    const c = mapComponentRow({
      id: 'x', quotation_item_id: 'qi-1', sort_order: '2', category: 'material',
      source_kind: null, label: 'Vinil', unit: 'm2', quantity: '1.5', unit_cost: '30.00',
      margin_percent: '35', scope: 'unit', is_included: true,
    });
    expect(c.quantity).toBe(1.5);
    expect(c.unit_cost).toBe(30);
    expect(c.margin_percent).toBe(35);
    expect(c.sort_order).toBe(2);
  });
});
