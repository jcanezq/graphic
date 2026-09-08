// ============================================================
// CotiGrafix — Cost Calculation Engine
// ============================================================

import type { Product, ProductMaterial, ProductLabor, ProductIndirectCost, QuotationItem } from '@/types';

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
  overrides?: { quantity?: number; margin_percent?: number; unit_cost?: number; has_labor?: boolean; has_design?: boolean; has_transport?: boolean }
): QuotationItem {
  const quantity = overrides?.quantity ?? item.quantity;
  const marginPercent = overrides?.margin_percent ?? item.margin_percent;
  
  const hasLabor = overrides?.has_labor ?? item.has_labor ?? true;
  const hasDesign = overrides?.has_design ?? item.has_design ?? true;
  const hasTransport = overrides?.has_transport ?? item.has_transport ?? true;
  
  let unitCost = item.unit_cost;
  
  if (overrides?.unit_cost !== undefined) {
    unitCost = overrides.unit_cost;
  } else if (overrides?.has_labor !== undefined || overrides?.has_design !== undefined || overrides?.has_transport !== undefined) {
    // Recalculate unit cost from base components if toggles change
    const activeLaborCost = hasLabor ? item.labor_cost : 0;
    const activeDesignCost = hasDesign ? 0 : -(item.design_cost || 0); // subtract design if not active
    const activeTransportCost = hasTransport ? 0 : -(item.transport_cost || 0); // subtract transport if not active
    // We assume the stored item.indirect_cost INCLUDES design and transport costs.
    unitCost = item.material_cost + activeLaborCost + item.indirect_cost + activeDesignCost + activeTransportCost;
    if (unitCost < 0) unitCost = 0;
  }
  
  const unitPrice = calcUnitPrice(unitCost, marginPercent);
  const subtotal = calcItemSubtotal(quantity, unitPrice);

  return {
    ...item,
    has_labor: hasLabor,
    has_design: hasDesign,
    has_transport: hasTransport,
    unit_cost: unitCost,
    quantity,
    margin_percent: marginPercent,
    unit_price: round2(unitPrice),
    subtotal: round2(subtotal),
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
  
  // Extract design cost from indirect costs if it exists
  const designCostItem = (product.indirect_costs || []).find(ic => ic.concept.toLowerCase().includes('diseño') || ic.concept.toLowerCase().includes('design'));
  const designCost = designCostItem ? designCostItem.cost : 0;
  
  // Extract transport cost from indirect costs if it exists
  const transportCostItem = (product.indirect_costs || []).find(ic => ic.concept.toLowerCase().includes('transporte') || ic.concept.toLowerCase().includes('movilidad') || ic.concept.toLowerCase().includes('flete'));
  const transportCost = transportCostItem ? transportCostItem.cost : 0;
  
  const indirectCost = calcIndirectCost(product.indirect_costs || []);
  const unitCost = (product.manual_unit_cost != null && product.manual_unit_cost > 0) ? product.manual_unit_cost : (materialCost + laborCost + indirectCost);
  const margin = marginPercent ?? (product.default_margin ?? 0);
  const unitPrice = calcUnitPrice(unitCost, margin);
  const subtotal = calcItemSubtotal(quantity, unitPrice);

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
    unit_price: round2(unitPrice),
    subtotal: round2(subtotal),
  };
}

/**
 * Calculate quotation totals from items.
 */
export function calcQuotationTotals(items: QuotationItem[], igvRate: number = 0.18) {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const igv = subtotal * igvRate;
  const total = subtotal + igv;

  return {
    subtotal: round2(subtotal),
    igv: round2(igv),
    total: round2(total),
  };
}

/**
 * Round to 2 decimal places.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
