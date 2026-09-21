// ============================================================
// CotiGrafix — Mapper ÚNICO de persistencia de ítems (FASE 2)
// Los CINCO caminos de guardado DEBEN usar esta función.
// Agregar una columna nueva a quotation_items = tocar SOLO este archivo.
// ============================================================

import type { QuotationItem } from '@/types';
import { LEGACY_SCOPE, type QuotationItemComponent } from '@/lib/pricing';

const scopeOf = (v: unknown): string => (v === 'unit' ? 'unit' : LEGACY_SCOPE);

/** Fila lista para insertar en `quotation_items`. */
export function toQuotationItemRow(item: QuotationItem, sortOrder: number, quotationId?: string) {
  return {
    ...(quotationId ? { quotation_id: quotationId } : {}),
    product_id: item.product_id || null,
    item_type: item.item_type || 'Producto',
    sort_order: sortOrder,
    product_code: item.product_code || null,
    product_name: item.product_name,
    product_description: item.product_description || null,
    unit: item.unit,
    client_design_url: item.client_design_url || null,
    notes: item.notes || null,

    // Costos heredados: se siguen guardando como dato de costeo.
    // PROHIBIDO usarlos para calcular precios (ver src/lib/pricing.ts).
    material_cost: item.material_cost,
    labor_cost: item.labor_cost,
    indirect_cost: item.indirect_cost,
    design_cost: item.design_cost ?? 0,
    transport_cost: item.transport_cost ?? 0,

    // Fila base (canónica)
    unit_cost: item.unit_cost,
    quantity: item.quantity,
    margin_percent: item.margin_percent,
    unit_price: item.unit_price,
    subtotal: item.subtotal,

    // Componentes (canónicos) — las 9 columnas que ningún camino escribía.
    has_labor: item.has_labor ?? true,
    labor_quantity: item.labor_quantity ?? 1,
    labor_unit_cost: item.labor_unit_cost ?? item.labor_cost ?? 0,
    labor_margin_percent: item.labor_margin_percent ?? item.margin_percent,
    labor_scope: scopeOf(item.labor_scope),

    has_design: item.has_design ?? true,
    design_quantity: item.design_quantity ?? 1,
    design_unit_cost: item.design_unit_cost ?? item.design_cost ?? 0,
    design_margin_percent: item.design_margin_percent ?? item.margin_percent,
    design_scope: scopeOf(item.design_scope),

    has_transport: item.has_transport ?? true,
    transport_quantity: item.transport_quantity ?? 1,
    transport_unit_cost: item.transport_unit_cost ?? item.transport_cost ?? 0,
    transport_margin_percent: item.transport_margin_percent ?? item.margin_percent,
    transport_scope: scopeOf(item.transport_scope),
  };
}

/** Una fila lista para insertar en `quotation_item_components`. */
export function toQuotationItemComponentRow(
  c: QuotationItemComponent,
  sortOrder: number,
  quotationItemId?: string,
) {
  return {
    ...(quotationItemId ? { quotation_item_id: quotationItemId } : {}),
    sort_order: c.sort_order ?? sortOrder,
    category: c.category,
    source_kind: c.source_kind ?? null,
    label: c.label,
    unit: c.unit ?? null,
    quantity: c.quantity,
    unit_cost: c.unit_cost,
    margin_percent: c.margin_percent,
    scope: c.scope,
    is_included: c.is_included,
  };
}

/** La receta de un ítem, lista para persistir. Vacía si el ítem no tiene. */
export function toQuotationItemComponentRows(
  item: QuotationItem & { _components?: QuotationItemComponent[] },
  quotationItemId?: string,
) {
  return (item._components ?? []).map((c, j) => toQuotationItemComponentRow(c, j, quotationItemId));
}

/**
 * El payload de `replace_quotation_items`: cada ítem con SU receta adentro.
 *
 * La receta viaja anidada y no en una llamada aparte porque el RPC borra los
 * ítems, y `quotation_item_components` cuelga de ellos ON DELETE CASCADE: si la
 * receta se escribiera en un segundo viaje, entre uno y otro existiría una
 * cotización con ítems y sin receta. Adentro de la función es una transacción,
 * y esa ventana no existe.
 *
 * `components` NO es una columna de `quotation_items`: la función la lee aparte
 * y el respaldo del panel la saca de la fila antes de insertar.
 */
export function toReplaceItemsPayload(
  items: Array<QuotationItem & { _components?: QuotationItemComponent[] }>,
) {
  return items.map((item, idx) => ({
    ...toQuotationItemRow(item, idx),
    components: toQuotationItemComponentRows(item),
  }));
}
