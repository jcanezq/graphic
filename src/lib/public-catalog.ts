// ============================================================
// CotiGrafix — La receta tal como la ve el CLIENTE
//
// El catálogo público publica la composición del producto con precios de venta
// (nunca costos ni márgenes). Esta es LA función que la arma, y existe por una
// razón puntual: antes el mapeo vivía suelto dentro del handler
// `/api/public/products`, así que la única forma de probarlo era reescribirlo a
// mano en el test — y un test que reimplementa lo que debería verificar no
// verifica nada. Con la receta acá, el test llama a la MISMA función que el
// servidor y cualquier campo que se pierda en el camino se ve.
//
// ⚠ El mapeo (categoría, source_kind, scope) tiene que coincidir campo por campo
// con `createQuotationItemFromProduct` (src/lib/calculations.ts), que es lo que
// el servidor termina guardando. Si los dos divergen, el carrito le muestra al
// cliente un número y la cotización guardada dice otro.
// ============================================================

import { round2 } from '@/lib/pricing';

/** Un subcomponente publicado al catálogo público: SOLO precio de venta. */
export interface PublicComponent {
  label: string;
  unit: string;
  unit_price: number;
  scope: string;
  category: string;
  source_kind: string | null;
}

export interface PublicMaterialRow {
  name?: string | null;
  unit?: string | null;
  quantity?: number | null;
  unit_cost?: number | null;
}
export interface PublicLaborRow {
  work_type?: string | null;
  unit?: string | null;
  hours?: number | null;
  hourly_rate?: number | null;
}
export interface PublicIndirectRow {
  concept?: string | null;
  kind?: string | null;
  unit?: string | null;
  quantity?: number | null;
  unit_cost?: number | null;
}

/**
 * Arma los subcomponentes públicos de un producto.
 *
 * ⚠ COSTO MANUAL: no se publica receta. Su precio NO es la suma de sus partes
 * —el costo manual reemplaza materiales e indirectos—, así que una lista de
 * piezas cuya suma contradice el precio haría que el carrito cobrara la receta
 * y el servidor el costo manual. Mismo criterio que
 * `createQuotationItemFromProduct`: sin receta, manda la fila base.
 */
export function buildPublicComponents(
  product: { manual_unit_cost?: number | null; default_margin?: number | null },
  materials: PublicMaterialRow[],
  labor: PublicLaborRow[],
  indirects: PublicIndirectRow[],
): PublicComponent[] {
  const usaCostoManual = product.manual_unit_cost != null && product.manual_unit_cost > 0;
  if (usaCostoManual) return [];

  const margin = product.default_margin ?? 30;
  const precioVenta = (costo: number) => round2(costo * (1 + margin / 100));

  const out: PublicComponent[] = [];

  for (const m of materials) {
    const uc = Number(m.unit_cost ?? 0);
    if (!(uc > 0)) continue;
    out.push({
      label: m.name ?? 'Material',
      unit: m.unit ?? 'unidad',
      unit_price: precioVenta(uc),
      scope: 'unit',
      category: 'material',
      source_kind: null,
    });
  }

  for (const l of labor) {
    const uc = Number(l.hourly_rate ?? 0);
    if (!(uc > 0)) continue;
    out.push({
      label: l.work_type ?? 'Mano de Obra',
      unit: l.unit ?? 'hr',
      unit_price: precioVenta(uc),
      scope: 'unit',
      category: 'labor',
      source_kind: null,
    });
  }

  for (const ic of indirects) {
    const uc = Number(ic.unit_cost ?? 0);
    if (!(uc > 0)) continue;
    let category = 'other';
    let source_kind: string | null = null;
    let scope = 'unit';
    if (ic.kind === 'design') { category = 'production'; source_kind = 'design'; scope = 'order'; }
    else if (ic.kind === 'production') { category = 'production'; }
    else if (ic.kind === 'transport') { source_kind = 'transport'; scope = 'order'; }
    out.push({
      label: ic.concept ?? 'Indirecto',
      unit: ic.unit ?? 'unidad',
      unit_price: precioVenta(uc),
      scope,
      category,
      source_kind,
    });
  }

  return out;
}
