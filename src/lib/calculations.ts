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
  overrides?: { quantity?: number; margin_percent?: number; unit_cost?: number }
): QuotationItem {
  const unitCost = overrides?.unit_cost ?? item.unit_cost;
  const quantity = overrides?.quantity ?? item.quantity;
  const marginPercent = overrides?.margin_percent ?? item.margin_percent;
  const unitPrice = calcUnitPrice(unitCost, marginPercent);
  const subtotal = calcItemSubtotal(quantity, unitPrice);

  return {
    ...item,
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
  const indirectCost = calcIndirectCost(product.indirect_costs || []);
  const unitCost = product.manual_unit_cost ?? (materialCost + laborCost + indirectCost);
  const margin = marginPercent ?? product.default_margin;
  const unitPrice = calcUnitPrice(unitCost, margin);
  const subtotal = calcItemSubtotal(quantity, unitPrice);

  return {
    product_id: product.id,
    sort_order: sortOrder,
    product_code: product.code,
    product_name: product.name,
    product_description: product.description || '',
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
