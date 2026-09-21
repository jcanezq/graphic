// ============================================================
// CotiGrafix — Cost Calculation Engine
// ============================================================

import type { Product, ProductMaterial, ProductLabor, ProductIndirectCost, QuotationItem } from '@/types';

import {
  buildItemLines, buildItemLinesFromComponents, itemSubtotal, itemSubtotalFromComponents,
  quotationTotals, COMPONENT_SCOPE_DEFAULTS, LEGACY_SCOPE,
  type PricedItemInput, type Scope, type PriceLine, type QuotationItemComponent,
} from '@/lib/pricing';
export type { PriceLine, QuotationItemComponent } from '@/lib/pricing';

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
 * Costo de UNA fila de indirecto. Única definición en todo el sistema.
 * `quantity` y `unit_cost` son NOT NULL en la base (f5_standardize_columns), así que
 * `cost` es una columna DERIVADA y no se lee para calcular. El fallback existe sólo
 * para objetos que no vienen de la base: estado del formulario y fixtures.
 */
export function indirectRowCost(
  ic: { quantity?: number | null; unit_cost?: number | null; cost?: number | null },
): number {
  if (ic.quantity != null && ic.unit_cost != null) {
    return Number(ic.quantity) * Number(ic.unit_cost);
  }
  return Number(ic.cost || 0);
}

/**
 * Calculate total indirect costs for a product.
 * Σ(indirect.cost)
 */
export function calcIndirectCost(indirects: ProductIndirectCost[]): number {
  return indirects.reduce((sum, ic) => sum + indirectRowCost(ic), 0);
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
export type CatalogPricing = {
  margin: number;
  materialCost: number;
  laborCost: number;
  designCost: number;
  transportCost: number;
  otherIndirectCost: number;
  baseCost: number;
  baseUnitPrice: number;
  laborPrice: number;
  designPrice: number;
  transportPrice: number;
  materialPrice: number;
  otherPrice: number;
  /** Precio de UNA unidad con todos los componentes activos. */
  unitPrice: number;
};

export function buildCatalogPricing(
  product: { manual_unit_cost?: number | null; default_margin?: number | null },
  materials: Array<{ quantity: number; unit_cost: number }>,
  labor: Array<{ hours: number; hourly_rate: number }>,
  indirects: Array<{ concept: string; kind?: string | null; quantity?: number | null; unit_cost?: number | null; cost?: number | null }>,
): CatalogPricing {
  const margin = product.default_margin ?? 30;
  const materialCostRaw = materials.reduce((acc: number, m: any) => acc + (m.quantity * m.unit_cost), 0);
  const laborCostRaw = labor.reduce((acc: number, l: any) => acc + (l.hours * l.hourly_rate), 0);
  
  const designCostRaw = sumIndirectByKind(indirects as any, 'design');
  const transportCostRaw = sumIndirectByKind(indirects as any, 'transport');
  
  const totalIndirectRaw = calcIndirectCost(indirects as any);
  const otherIndirectRaw = totalIndirectRaw - designCostRaw - transportCostRaw;

  const baseCost = (product.manual_unit_cost != null && product.manual_unit_cost > 0)
    ? product.manual_unit_cost
    : (materialCostRaw + otherIndirectRaw);
  const baseUnitPrice = round2(calcUnitPrice(baseCost, margin));

  const unitPrice = round2(
    baseUnitPrice
    + round2(calcUnitPrice(laborCostRaw, margin))
    + round2(calcUnitPrice(designCostRaw, margin))
    + round2(calcUnitPrice(transportCostRaw, margin))
  );
  
  const laborPrice = round2(calcUnitPrice(laborCostRaw, margin));
  const designPrice = round2(calcUnitPrice(designCostRaw, margin));
  const transportPrice = round2(calcUnitPrice(transportCostRaw, margin));
  const materialPrice = round2(calcUnitPrice(materialCostRaw, margin));
  const otherPrice = round2(calcUnitPrice(otherIndirectRaw, margin));

  return {
    margin,
    materialCost: materialCostRaw,
    laborCost: laborCostRaw,
    designCost: designCostRaw,
    transportCost: transportCostRaw,
    otherIndirectCost: otherIndirectRaw,
    baseCost,
    baseUnitPrice,
    laborPrice,
    designPrice,
    transportPrice,
    materialPrice,
    otherPrice,
    unitPrice
  };
}

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

  const next = {
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

  // Si el ítem tiene receta, ELLA manda: las columnas legadas se siguen
  // guardando como dato de costeo, pero el precio sale de los subcomponentes.
  return repriceItemFromComponents(next as any);
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
  const designCost = sumIndirectByKind(product.indirect_costs, 'design');
  const transportCost = sumIndirectByKind(product.indirect_costs, 'transport');
  
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

  // ---- SUBC: construir la lista de subcomponentes -------------------------
  // Se copia el detalle del catálogo; si no hay receta, la lista queda vacía.
  // Mapeo según la tabla del spec §SUBC-T3.
  //
  // COSTO MANUAL: un producto con `manual_unit_cost` declara que su precio NO
  // es la suma de sus partes — el costo manual REEMPLAZA materiales e
  // indirectos (ver `calcUnitCost` y `buildCatalogPricing`). Publicarle una
  // receta cobrable sería contradecir su propio precio: la receta pasaría a
  // mandar y el ítem dejaría de coincidir con el Precio Venta del panel. Por
  // eso se queda sin receta y lo cotiza el motor legado, con la fila base
  // llevando el costo manual y la mano de obra / diseño / transporte encima.
  const usaCostoManual = product.manual_unit_cost != null && product.manual_unit_cost > 0;
  const components: QuotationItemComponent[] = [];
  let sortIdx = 0;

  for (const m of (usaCostoManual ? [] : product.materials || [])) {
    components.push({
      sort_order: sortIdx++,
      category: 'material',
      source_kind: null,
      label: m.name,
      unit: m.unit || null,
      quantity: m.quantity,
      unit_cost: round2(m.unit_cost),
      margin_percent: margin,
      scope: 'unit',
      is_included: true,
    });
  }

  for (const l of (usaCostoManual ? [] : product.labor || [])) {
    components.push({
      sort_order: sortIdx++,
      category: 'labor',
      source_kind: null,
      label: l.work_type,
      unit: l.unit || null,
      quantity: l.hours,
      unit_cost: round2(l.hourly_rate),
      margin_percent: margin,
      scope: 'unit',
      is_included: true,
    });
  }

  for (const ic of (usaCostoManual ? [] : product.indirect_costs || [])) {
    const kind = ic.kind;
    let category: QuotationItemComponent['category'];
    let source_kind: QuotationItemComponent['source_kind'] = null;
    let scope: QuotationItemComponent['scope'];
    if (kind === 'design') {
      category = 'production'; source_kind = 'design'; scope = 'order';
    } else if (kind === 'production') {
      category = 'production'; scope = 'unit';
    } else if (kind === 'transport') {
      category = 'other'; source_kind = 'transport'; scope = 'order';
    } else {
      // kind === 'other' o null
      category = 'other'; scope = 'unit';
    }
    components.push({
      sort_order: sortIdx++,
      category,
      source_kind,
      label: ic.concept,
      unit: ic.unit || null,
      quantity: Number(ic.quantity ?? 1),
      unit_cost: round2(Number(ic.unit_cost ?? ic.cost ?? 0)),
      margin_percent: margin,
      scope,
      is_included: true,
    });
  }
  // -------------------------------------------------------------------------

  const nuevo = {
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
    // Lista de subcomponentes para persistir en quotation_item_components.
    // No es una columna real de quotation_items: sólo viaja en memoria.
    _components: components,
  } as QuotationItem & { _components: QuotationItemComponent[] };

  // Con receta, el precio del ítem son sus subcomponentes (no la base + ellos).
  return repriceItemFromComponents(nuevo);
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


/** Costo total de un componente opcional. Suma TODAS sus filas: si un artículo
 *  tiene «Diseño gráfico» y «Diseño personalizado», los dos son diseño. Antes se
 *  tomaba sólo la primera, y cuál era la primera no estaba definido. */
export function sumIndirectByKind(
  indirects: Array<{ concept: string; cost?: number | null; kind?: string | null; quantity?: number | null; unit_cost?: number | null }> | undefined | null,
  kind: 'design' | 'transport',
): number {
  const list = indirects || [];
  const propias = list.filter((ic) => ic.kind === kind);
  if (propias.length > 0) {
    return propias.reduce((acc, ic) => acc + indirectRowCost(ic as any), 0);
  }
  return 0;
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

/** Filas cobrables de un ítem ya persistido. Lo que imprimen PDF y Excel.
 * Si el ítem trae _components (cargados de quotation_item_components), usa el
 * motor dinámico. Si no (cotización vieja, o ítem sin receta), usa el legado.
 * La compatibilidad hacia atrás es obligatoria: cotizaciones viejas no se tocan.
 */
export function buildQuotationItemLines(item: QuotationItem & { _components?: QuotationItemComponent[] }): PriceLine[] {
  const comps = (item as any)._components as QuotationItemComponent[] | undefined;
  if (comps && comps.length > 0) {
    return buildItemLinesFromComponents(
      Number(item.quantity) || 0,
      Number(item.unit_cost) || 0,
      Number(item.margin_percent) || 0,
      item.unit,
      comps,
    );
  }
  // Legado: columnas has_labor / has_design / has_transport
  return buildItemLines(toPricedItem(item));
}

/**
 * Vuelve a poner el precio del ítem a partir de SU receta, y es la única vía
 * para que el interruptor `is_included` signifique algo en el dinero.
 *
 * Antes no existía: el subtotal salía del motor legado (has_labor /
 * has_design / has_transport), que no mira los subcomponentes. Destildar una
 * fila en el carrito o en el panel apagaba la fila en pantalla y el total no se
 * movía ni un centavo. Ahora el subtotal guardado y las filas impresas salen de
 * la misma función, así que no pueden contar cosas distintas.
 *
 * Sin receta devuelve el ítem intacto: esa es la ruta legada y no se toca.
 */
export function repriceItemFromComponents<
  T extends QuotationItem & { _components?: QuotationItemComponent[] },
>(item: T): T {
  const comps = item._components;
  if (!comps || comps.length === 0) return item;

  const unitCost = Number(item.unit_cost) || 0;
  const margin = Number(item.margin_percent) || 0;
  return {
    ...item,
    // P.V. unitario = lo que cuesta UNA unidad con lo que quedó tildado.
    // Es el mismo número que muestra «Precio Venta» en el panel.
    unit_price: itemSubtotalFromComponents(1, unitCost, margin, item.unit, comps),
    subtotal: itemSubtotalFromComponents(Number(item.quantity) || 0, unitCost, margin, item.unit, comps),
  };
}
