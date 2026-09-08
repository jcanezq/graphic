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
  const laborUC = overrides?.labor_unit_cost ?? item.labor_unit_cost ?? item.labor_cost;
  const laborMargin = overrides?.labor_margin_percent ?? item.labor_margin_percent ?? marginPercent;

  const designQty = overrides?.design_quantity ?? item.design_quantity ?? 1;
  const designUC = overrides?.design_unit_cost ?? item.design_unit_cost ?? item.design_cost ?? 0;
  const designMargin = overrides?.design_margin_percent ?? item.design_margin_percent ?? marginPercent;

  const transportQty = overrides?.transport_quantity ?? item.transport_quantity ?? 1;
  const transportUC = overrides?.transport_unit_cost ?? item.transport_unit_cost ?? item.transport_cost ?? 0;
  const transportMargin = overrides?.transport_margin_percent ?? item.transport_margin_percent ?? marginPercent;

  // Base item subtotal
  const baseUnitPrice = calcUnitPrice(unitCost, marginPercent);
  const baseSubtotal = calcItemSubtotal(quantity, baseUnitPrice);

  // Component subtotals
  const laborUP = calcUnitPrice(laborUC, laborMargin);
  const laborSubtotal = hasLabor ? calcItemSubtotal(laborQty, laborUP) : 0;

  const designUP = calcUnitPrice(designUC, designMargin);
  const designSubtotal = hasDesign ? calcItemSubtotal(designQty, designUP) : 0;

  const transportUP = calcUnitPrice(transportUC, transportMargin);
  const transportSubtotal = hasTransport ? calcItemSubtotal(transportQty, transportUP) : 0;

  // Total subtotal
  const totalSubtotal = baseSubtotal + laborSubtotal + designSubtotal + transportSubtotal;
  
  // Represent average unit price
  const totalUnitPrice = quantity > 0 ? (totalSubtotal / quantity) : 0;

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
    unit_price: round2(totalUnitPrice),
    subtotal: round2(totalSubtotal),
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
  const baseIndirectCost = indirectCost - designCost - transportCost;
  
  const unitCost = (product.manual_unit_cost != null && product.manual_unit_cost > 0) 
    ? product.manual_unit_cost 
    : (materialCost + baseIndirectCost);
    
  const margin = marginPercent ?? (product.default_margin ?? 0);
  
  const baseUnitPrice = calcUnitPrice(unitCost, margin);
  const baseSubtotal = calcItemSubtotal(quantity, baseUnitPrice);

  const laborUP = calcUnitPrice(laborCost, margin);
  const laborSubtotal = calcItemSubtotal(1, laborUP);

  const designUP = calcUnitPrice(designCost, margin);
  const designSubtotal = calcItemSubtotal(1, designUP);

  const transportUP = calcUnitPrice(transportCost, margin);
  const transportSubtotal = calcItemSubtotal(1, transportUP);

  const totalSubtotal = baseSubtotal + laborSubtotal + designSubtotal + transportSubtotal;
  const totalUnitPrice = quantity > 0 ? (totalSubtotal / quantity) : 0;

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
    unit_price: round2(totalUnitPrice),
    subtotal: round2(totalSubtotal),
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
