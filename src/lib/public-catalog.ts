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
import { buildComponentRowKeys } from '@/lib/component-selection';

/**
 * Un subcomponente publicado al catálogo público: SOLO precio de venta.
 *
 * `quantity` es la cantidad de la RECETA —4 m lineales de canto por módulo—, y
 * viaja aparte del precio a propósito. Doblarla dentro de `unit_price` daría el
 * mismo dinero, pero el cliente leería «1 m lineal a S/ 6.48» donde el panel
 * dice «4 m lineales a S/ 1.62»: el subtotal de una fila tiene que seguir
 * siendo su cantidad por su precio unitario, o el documento no se puede auditar.
 */
export interface PublicComponent {
  /**
   * La identidad de ESTA fila, para que el cliente pueda decir cuál destildó.
   * No tiene `id` —el id nace al guardar la cotización— así que la clave sale
   * del contenido. Ver `src/lib/component-selection.ts`, que la calcula tanto
   * acá como en el servidor al reconstruir el ítem: son la MISMA función, y si
   * dejaran de serlo el cliente apagaría una fila y el servidor otra.
   */
  key: string;
  label: string;
  unit: string;
  quantity: number;
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

  // ⚠ La receta se recorre ENTERA, incluidas las filas que no cobran (costo
  // cero). Las claves se calculan sobre esa lista completa y recién DESPUÉS se
  // descartan las que no se publican. Filtrar primero rompería el contrato con
  // el servidor: él reconstruye la receta completa, así que una fila gratis con
  // nombre repetido correría el desempate `#2` de un lado y no del otro, y el
  // cliente terminaría apagando la fila de al lado.
  const todas: Array<PublicComponent & { _cobra: boolean }> = [];

  for (const m of materials) {
    const uc = Number(m.unit_cost ?? 0);
    todas.push({
      key: '',
      label: m.name ?? 'Material',
      unit: m.unit ?? 'unidad',
      quantity: Number(m.quantity ?? 1),
      unit_price: precioVenta(uc > 0 ? uc : 0),
      scope: 'unit',
      category: 'material',
      source_kind: null,
      _cobra: uc > 0,
    });
  }

  for (const l of labor) {
    const uc = Number(l.hourly_rate ?? 0);
    todas.push({
      key: '',
      label: l.work_type ?? 'Mano de Obra',
      unit: l.unit ?? 'hr',
      quantity: Number(l.hours ?? 1),
      unit_price: precioVenta(uc > 0 ? uc : 0),
      scope: 'unit',
      category: 'labor',
      source_kind: null,
      _cobra: uc > 0,
    });
  }

  for (const ic of indirects) {
    const uc = Number(ic.unit_cost ?? 0);
    let category = 'other';
    let source_kind: string | null = null;
    let scope = 'unit';
    if (ic.kind === 'design') { category = 'production'; source_kind = 'design'; scope = 'order'; }
    else if (ic.kind === 'production') { category = 'production'; }
    else if (ic.kind === 'transport') { source_kind = 'transport'; scope = 'order'; }
    todas.push({
      key: '',
      label: ic.concept ?? 'Indirecto',
      unit: ic.unit ?? 'unidad',
      quantity: Number(ic.quantity ?? 1),
      unit_price: precioVenta(uc > 0 ? uc : 0),
      scope,
      category,
      source_kind,
      _cobra: uc > 0,
    });
  }

  const claves = buildComponentRowKeys(todas);

  return todas
    .map((c, i) => ({ ...c, key: claves[i] }))
    .filter((c) => c._cobra)
    .map(({ _cobra, ...publicable }) => publicable);
}
