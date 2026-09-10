// ============================================================
// CotiGrafix — Mapper ÚNICO de persistencia de ítems (FASE 2)
// Los CINCO caminos de guardado DEBEN usar esta función.
// Agregar una columna nueva a quotation_items = tocar SOLO este archivo.
// ============================================================

import type { QuotationItem } from '@/types';
import { LEGACY_SCOPE } from '@/lib/pricing';

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
