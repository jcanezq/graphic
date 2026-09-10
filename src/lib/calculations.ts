// ============================================================
// CotiGrafix — Cost Calculation Engine
// ============================================================

import type { Product, ProductMaterial, ProductLabor, ProductIndirectCost, QuotationItem } from '@/types';
import { normalizeText } from '@/lib/formatters';
import {
  buildItemLines, itemSubtotal, quotationTotals,
  COMPONENT_SCOPE_DEFAULTS, LEGACY_SCOPE,
  type PricedItemInput, type Scope, type PriceLine,
} from '@/lib/pricing';
export type { PriceLine } from '@/lib/pricing';

/**
 * Calculate total material cost for a product.
 * Σ(material.quantity × material.unit_cost)
 */
export function calcMaterialCost(materials: ProductMaterial[]): number {
  return materials.reduce((sum, m) => sum + (m.quantity * m.unit_cost), 0);
}

/**
 * Calculate total labor cost for a product.
 * Σ(labor.hours × labor.hourly_rate)
 */
export function calcLaborCost(labor: ProductLabor[]): number {
  return labor.reduce((sum, l) => sum + (l.hours * l.hourly_rate), 0);
}

/**
 * Calculate total indirect costs for a product.
 * Σ(indirect.cost)
 */
export function calcIndirectCost(indirects: ProductIndirectCost[]): number {
  return indirects.reduce((sum, ic) => sum + ic.cost, 0);
}

/**
 * ⚠ NO USAR PARA PRECIOS DE VENTA. Suma materiales + mano de obra + TODOS los
 * indirectos, es decir mete los componentes de servicio dentro del costo base.
 * Usarla para cotizar fue la causa de C-1 (el carrito cobraba los componentes
 * x cantidad y el servidor x 1). Para precios: src/lib/pricing.ts.
 *
 * Calculate the unit cost of a product.
 * If manual_unit_cost is set, use that. Otherwise, sum materials + labor + indirects.
 */
export function calcUnitCost(product: {
  manual_unit_cost?: number | null;
  materials?: ProductMaterial[];
  labor?: ProductLabor[];
  indirect_costs?: ProductIndirectCost[];
}): number {
  if (product.manual_unit_cost != null && product.manual_unit_cost > 0) {
    return product.manual_unit_cost;
  }

  const materialCost = calcMaterialCost(product.materials || []);
  const laborCost = calcLaborCost(product.labor || []);
  const indirectCost = calcIndirectCost(product.indirect_costs || []);

  return materialCost + laborCost + indirectCost;
}

/**
 * Calculate sale price with margin.
 * unit_price = unit_cost × (1 + margin_percent / 100)
 */
export function calcUnitPrice(unitCost: number, marginPercent: number): number {
  return unitCost * (1 + marginPercent / 100);
}

/**
 * Calculate item subtotal.
 * subtotal = quantity × unit_price
 */
export function calcItemSubtotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

/**
 * Recalculate a single quotation item from product data.
 */
export function recalcQuotationItem(
  item: QuotationItem,
  overrides?: { 
    quantity?: number; margin_percent?: number; unit_cost?: number; 
    has_labor?: boolean | null; has_design?: boolean | null; has_transport?: boolean | null;
    labor_quantity?: number; labor_unit_cost?: number; labor_margin_percent?: number;
    design_quantity?: number; design_unit_cost?: number; design_margin_percent?: number;
    transport_quantity?: number; transport_unit_cost?: number; transport_margin_percent?: number;
  }
): QuotationItem {
  const quantity = overrides?.quantity ?? item.quantity;
  const marginPercent = overrides?.margin_percent ?? item.margin_percent;
  const unitCost = overrides?.unit_cost ?? item.unit_cost;
  
  const hasLabor = overrides?.has_labor ?? item.has_labor ?? true;
  const hasDesign = overrides?.has_design ?? item.has_design ?? true;
  const hasTransport = overrides?.has_transport ?? item.has_transport ?? true;
  
  const laborQty = overrides?.labor_quantity ?? item.labor_quantity ?? 1;
  const laborUC = overrides?.labor_unit_cost ?? item.labor_unit_cost ?? item.labor_cost ?? 0;
  const laborMargin = overrides?.labor_margin_percent ?? item.labor_margin_percent ?? marginPercent;

  const designQty = overrides?.design_quantity ?? item.design_quantity ?? 1;
  const designUC = overrides?.design_unit_cost ?? item.design_unit_cost ?? item.design_cost ?? 0;
  const designMargin = overrides?.design_margin_percent ?? item.design_margin_percent ?? marginPercent;

  const transportQty = overrides?.transport_quantity ?? item.transport_quantity ?? 1;
  const transportUC = overrides?.transport_unit_cost ?? item.transport_unit_cost ?? item.transport_cost ?? 0;
  const transportMargin = overrides?.transport_margin_percent ?? item.transport_margin_percent ?? marginPercent;

  // Todo el cálculo vive en el motor canónico (src/lib/pricing.ts).
  const priced = toPricedItem({
    ...item,
    quantity, margin_percent: marginPercent, unit_cost: unitCost,
    has_labor: hasLabor, has_design: hasDesign, has_transport: hasTransport,
    labor_quantity: laborQty, labor_unit_cost: laborUC, labor_margin_percent: laborMargin,
    design_quantity: designQty, design_unit_cost: designUC, design_margin_percent: designMargin,
    transport_quantity: transportQty, transport_unit_cost: transportUC, transport_margin_percent: transportMargin,
  } as QuotationItem);
  const totalSubtotal = itemSubtotal(priced);
  // unit_price = precio unitario de la fila BASE (ya no el promedio ponderado):
  // así toda fila impresa cumple cantidad x P.U. = subtotal (M-1).
  const baseUnitPrice = buildItemLines(priced)[0].unit_price;

  return {
    ...item,
    quantity,
    margin_percent: marginPercent,
    unit_cost: unitCost,
    has_labor: hasLabor,
    has_design: hasDesign,
    has_transport: hasTransport,
    labor_quantity: laborQty,
    labor_unit_cost: laborUC,
    labor_margin_percent: laborMargin,
    design_quantity: designQty,
    design_unit_cost: designUC,
    design_margin_percent: designMargin,
    transport_quantity: transportQty,
    transport_unit_cost: transportUC,
    transport_margin_percent: transportMargin,
    unit_price: baseUnitPrice,
    subtotal: totalSubtotal,
  };
}

/**
 * Create a quotation item from a product (snapshot).
 */
export function createQuotationItemFromProduct(
  product: Product,
  quantity: number = 1,
  marginPercent?: number,
  sortOrder: number = 0
): QuotationItem {
  const materialCost = calcMaterialCost(product.materials || []);
  const laborCost = calcLaborCost(product.labor || []);
  
  // Design / transport se identifican por `kind` (columna estable), no por texto.
  // Fallback por texto normalizado sólo para filas anteriores a la migración de `kind`.
  const designCostItem = findIndirectByKind(product.indirect_costs, 'design');
  const designCost = designCostItem ? designCostItem.cost : 0;

  const transportCostItem = findIndirectByKind(product.indirect_costs, 'transport');
  const transportCost = transportCostItem ? transportCostItem.cost : 0;
  
  const indirectCost = calcIndirectCost(product.indirect_costs || []);
  const baseIndirectCost = indirectCost - designCost - transportCost;
  
  const unitCost = (product.manual_unit_cost != null && product.manual_unit_cost > 0) 
    ? product.manual_unit_cost 
    : (materialCost + baseIndirectCost);
    
  const margin = marginPercent ?? (product.default_margin ?? 0);
  
  // Ítem NUEVO: toma la regla de escalado vigente del catálogo (la semilla).
  const priced: PricedItemInput = {
    quantity, unit_cost: unitCost, margin_percent: margin, unit: product.unit,
    labor:     { enabled: true, quantity: 1, unit_cost: laborCost,     margin_percent: margin, scope: COMPONENT_SCOPE_DEFAULTS.labor },
    design:    { enabled: true, quantity: 1, unit_cost: designCost,    margin_percent: margin, scope: COMPONENT_SCOPE_DEFAULTS.design },
    transport: { enabled: true, quantity: 1, unit_cost: transportCost, margin_percent: margin, scope: COMPONENT_SCOPE_DEFAULTS.transport },
  };
  const totalSubtotal = itemSubtotal(priced);
  const baseUnitPrice = buildItemLines(priced)[0].unit_price;

  return {
    item_type: product.type,
    has_labor: true,
    has_design: true,
    has_transport: true,
    design_cost: round2(designCost),
    transport_cost: round2(transportCost),
    product_id: product.id,
    sort_order: sortOrder,
    product_code: product.code,
    product_name: product.name,
    product_description:
      product.description &&
      !product.description.toLowerCase().includes("linea") &&
      !product.description.toLowerCase().includes("línea") &&
      !product.description.startsWith(product.name)
        ? product.description
        : '',
    unit: product.unit,
    material_cost: round2(materialCost),
    labor_cost: round2(laborCost),
    indirect_cost: round2(indirectCost),
    unit_cost: round2(unitCost),
    quantity,
    margin_percent: margin,
    labor_quantity: 1,
    labor_unit_cost: round2(laborCost),
    labor_margin_percent: margin,
    design_quantity: 1,
    design_unit_cost: round2(designCost),
    design_margin_percent: margin,
    transport_quantity: 1,
    transport_unit_cost: round2(transportCost),
    transport_margin_percent: margin,
    labor_scope: COMPONENT_SCOPE_DEFAULTS.labor,
    design_scope: COMPONENT_SCOPE_DEFAULTS.design,
    transport_scope: COMPONENT_SCOPE_DEFAULTS.transport,
    unit_price: baseUnitPrice,
    subtotal: totalSubtotal,
  };
}

/**
 * Calculate quotation totals from items.
 */
export function calcQuotationTotals(items: QuotationItem[], igvRate: number = 0.18) {
  return quotationTotals(items.map((i) => Number(i.subtotal) || 0), igvRate);
}

/**
 * Round to 2 decimal places.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Localiza un indirecto por su `kind`. Si la fila todavía no tiene `kind`
 * (dato previo a la migración), cae a coincidencia de texto NORMALIZADA
 * — sin tildes y en minúsculas — para que "Diseno" y "Diseño" sean lo mismo.
 */
export function findIndirectByKind(
  indirects: Array<{ concept: string; cost: number; kind?: string | null }> | undefined | null,
  kind: 'design' | 'transport',
) {
  const list = indirects || [];
  const byKind = list.find((ic) => ic.kind === kind);
  if (byKind) return byKind;
  const needles = kind === 'design'
    ? ['diseno', 'design']
    : ['transporte', 'movilidad', 'flete'];
  return list.find((ic) => {
    if (ic.kind && ic.kind !== 'other') return false;
    const n = normalizeText(ic.concept);
    return needles.some((x) => n.includes(x));
  });
}

/**
 * Traduce un QuotationItem al modelo canónico del motor de precios.
 * El scope se toma de la fila (persistido); si falta, LEGACY_SCOPE ('order'),
 * que es la regla con la que se calcularon las cotizaciones anteriores.
 */
export function toPricedItem(item: QuotationItem): PricedItemInput {
  const margin = Number(item.margin_percent) || 0;
  const asScope = (v: unknown): Scope => (v === 'unit' ? 'unit' : LEGACY_SCOPE);
  return {
    quantity: Number(item.quantity) || 0,
    unit_cost: Number(item.unit_cost) || 0,
    margin_percent: margin,
    unit: item.unit,
    labor: {
      enabled: item.has_labor ?? true,
      quantity: Number(item.labor_quantity ?? 1) || 0,
      unit_cost: Number(item.labor_unit_cost ?? item.labor_cost ?? 0) || 0,
      margin_percent: Number(item.labor_margin_percent ?? margin) || 0,
      scope: asScope((item as any).labor_scope),
    },
    design: {
      enabled: item.has_design ?? true,
      quantity: Number(item.design_quantity ?? 1) || 0,
      unit_cost: Number(item.design_unit_cost ?? item.design_cost ?? 0) || 0,
      margin_percent: Number(item.design_margin_percent ?? margin) || 0,
      scope: asScope((item as any).design_scope),
    },
    transport: {
      enabled: item.has_transport ?? true,
      quantity: Number(item.transport_quantity ?? 1) || 0,
      unit_cost: Number(item.transport_unit_cost ?? item.transport_cost ?? 0) || 0,
      margin_percent: Number(item.transport_margin_percent ?? margin) || 0,
      scope: asScope((item as any).transport_scope),
    },
  };
}

/** Filas cobrables de un ítem ya persistido. Lo que imprimen PDF y Excel. */
export function buildQuotationItemLines(item: QuotationItem): PriceLine[] {
  return buildItemLines(toPricedItem(item));
}
