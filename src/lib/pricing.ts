// ============================================================
// CotiGrafix — Motor canónico de precios (FASE 2)
// ÚNICA fuente de verdad. Ningún otro módulo debe calcular precios.
// ============================================================

export type ComponentKey = 'labor' | 'design' | 'transport';
export type Scope = 'unit' | 'order';

// ┌──────────────────────────────────────────────────────────┐
// │  ⚠ SEMILLA DE NEGOCIO — ÚNICO LUGAR DONDE SE DECIDE      │
// │  cómo escala cada componente de servicio.                │
// │    'unit'  → se multiplica por la cantidad del ítem      │
// │    'order' → cargo fijo por pedido                       │
// │  Cambiar el precio de la fábrica = cambiar estas 3       │
// │  líneas. No replicar este criterio en ningún otro lado.  │
// └──────────────────────────────────────────────────────────┘
export const COMPONENT_SCOPE_DEFAULTS: Record<ComponentKey, Scope> = {
  labor: 'unit',
  design: 'order',
  transport: 'order',
};

/** Scope de las cotizaciones creadas ANTES de la fase 2: todo era cargo fijo. */
export const LEGACY_SCOPE: Scope = 'order';

export const IGV_RATE_FALLBACK = 0.18;

export function round2(n: number): number {
  if (!Number.isFinite(n)) {
    throw new Error(`round2 recibió un valor no finito (${n}): hay un costo undefined o NaN en la ruta del dinero`);
  }
  return Math.round(n * 100) / 100;
}

/** Una fila cobrable. Invariante: subtotal === round2(quantity * unit_price). */
export interface PriceLine {
  key: 'base' | ComponentKey;
  label: string;
  unit: string;
  quantity: number;      // cantidad EFECTIVA (ya escalada)
  unit_cost: number;
  margin_percent: number;
  unit_price: number;
  subtotal: number;
}

/** Entrada del motor: el estado canónico de un ítem. */
export interface PricedItemInput {
  quantity: number;
  unit_cost: number;
  margin_percent: number;
  unit?: string;
  labor?: ComponentInput | null;
  design?: ComponentInput | null;
  transport?: ComponentInput | null;
}
export interface ComponentInput {
  enabled: boolean;
  quantity: number;
  unit_cost: number;
  margin_percent: number;
  scope: Scope;
}

const COMPONENT_META: Record<ComponentKey, { label: string; unit: string }> = {
  labor:     { label: 'Mano de Obra',            unit: 'hr' },
  design:    { label: 'Diseño Gráfico',          unit: 'hr' },
  transport: { label: 'Transporte / Movilidad',  unit: 'viaje' },
};

function makeLine(
  key: PriceLine['key'], label: string, unit: string,
  quantity: number, unitCost: number, marginPercent: number,
): PriceLine {
  const unit_price = round2(unitCost * (1 + marginPercent / 100));
  return { key, label, unit, quantity, unit_cost: unitCost, margin_percent: marginPercent,
           unit_price, subtotal: round2(quantity * unit_price) };
}

/**
 * Devuelve las filas cobrables de un ítem. Es LA función de precios.
 * Cada fila cumple subtotal === round2(quantity * unit_price), así que el
 * documento impreso cuadra consigo mismo sin excepción.
 */
export function buildItemLines(item: PricedItemInput): PriceLine[] {
  const lines: PriceLine[] = [
    makeLine('base', 'base', item.unit || 'unidad', item.quantity, item.unit_cost, item.margin_percent),
  ];
  for (const key of ['labor', 'design', 'transport'] as ComponentKey[]) {
    const c = item[key];
    if (!c || !c.enabled) continue;
    if (!(c.unit_cost > 0)) continue;
    const effectiveQty = c.scope === 'unit' ? c.quantity * item.quantity : c.quantity;
    if (!(effectiveQty > 0)) continue;
    const meta = COMPONENT_META[key];
    lines.push(makeLine(key, meta.label, meta.unit, effectiveQty, c.unit_cost, c.margin_percent));
  }
  return lines;
}

/** Total de la línea = suma de sus filas ya redondeadas. */
export function itemSubtotal(item: PricedItemInput): number {
  return round2(buildItemLines(item).reduce((s, l) => s + l.subtotal, 0));
}

/** Totales de la cotización = suma de subtotales de ítem ya redondeados. */
export function quotationTotals(itemSubtotals: number[], igvRate: number = IGV_RATE_FALLBACK) {
  const subtotal = round2(itemSubtotals.reduce((s, x) => s + round2(x), 0));
  const igv = round2(subtotal * igvRate);
  return { subtotal, igv, total: round2(subtotal + igv) };
}

// ============================================================
// SUBC — Subcomponentes dinámicos (todos opcionales)
// ============================================================

/**
 * Un subcomponente copiado del catálogo en el momento de cotizar.
 * Se persiste en `quotation_item_components`.
 */
export interface QuotationItemComponent {
  /** ID de la fila en `quotation_item_components`. Presente al leer de DB; ausente al crear. */
  id?: string;
  sort_order: number;
  /** Las cuatro categorías del modelo de costos. */
  category: 'material' | 'labor' | 'production' | 'other';
  /** Distingue diseño y transporte dentro de production/other. */
  source_kind?: 'design' | 'transport' | null;
  label: string;
  unit?: string | null;
  quantity: number;
  unit_cost: number;
  margin_percent: number;
  /** 'unit' se multiplica por la cantidad del ítem; 'order' se cobra una vez. */
  scope: 'unit' | 'order';
  /** EL INTERRUPTOR: el cliente puede activar o desactivar cada subcomponente. */
  is_included: boolean;
}

/**
 * Devuelve las filas cobrables de un ítem usando su lista de subcomponentes.
 * ⚠ La fórmula es markup: precio = costo × (1 + margen/100). NO CAMBIAR.
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  LA RECETA ES EL PRODUCTO, NO UN EXTRA.                  │
 * │  Si el ítem trae subcomponentes, ELLOS son el producto:  │
 * │  la fila `base` NO se emite, porque sumarla cobraría el  │
 * │  mismo producto dos veces (defecto SRV-2026-0507: 364.50 │
 * │  donde el panel de administración decía 195.75).         │
 * │  La base sólo sobrevive cuando NO hay receta — ahí sí    │
 * │  representa el producto entero.                          │
 * └──────────────────────────────────────────────────────────┘
 *
 * Costo manual: quien arma el ítem NO le pone receta (ver
 * `createQuotationItemFromProduct`), justamente porque su precio no es la suma
 * de sus partes. Le toca esta rama de acá abajo, con la base mandando.
 */
export function buildItemLinesFromComponents(
  itemQty: number,
  itemUnitCost: number,
  itemMargin: number,
  itemUnit: string | undefined,
  components: QuotationItemComponent[],
): PriceLine[] {
  const unit = itemUnit || 'unidad';

  // Sin receta: la fila base ES el producto.
  if (components.length === 0) {
    return [makeLine('base', 'base', unit, itemQty, itemUnitCost, itemMargin)];
  }

  const lines: PriceLine[] = [];
  for (const c of components) {
    if (!c.is_included) continue;
    if (!(c.unit_cost > 0)) continue;
    const effectiveQty = c.scope === 'unit' ? c.quantity * itemQty : c.quantity;
    if (!(effectiveQty > 0)) continue;
    // Usamos 'base' como key genérico; el label distingue cada fila.
    lines.push(makeLine('base', c.label, c.unit || 'unidad', effectiveQty, c.unit_cost, c.margin_percent));
  }

  // Receta con TODO destildado: el ítem no cobra nada. Se emite una sola fila a
  // cero para que el ítem no desaparezca del documento sin avisar, pero la base
  // NO reaparece con su precio: un ítem vacío que cobrara igual sería el mismo
  // defecto al revés.
  if (lines.length === 0) {
    return [makeLine('base', 'base', unit, itemQty, 0, itemMargin)];
  }
  return lines;
}

/** Total de un ítem con subcomponentes dinámicos. */
export function itemSubtotalFromComponents(
  itemQty: number,
  itemUnitCost: number,
  itemMargin: number,
  itemUnit: string | undefined,
  components: QuotationItemComponent[],
): number {
  return round2(
    buildItemLinesFromComponents(itemQty, itemUnitCost, itemMargin, itemUnit, components)
      .reduce((s, l) => s + l.subtotal, 0),
  );
}

// ============================================================
// CARRITO PÚBLICO — el cliente ve precios de venta, nunca costos
// ============================================================

/**
 * Un subcomponente tal como lo publica /api/public/products: SOLO precio de
 * venta. El costo y el margen no salen del servidor.
 */
export interface CartComponentInput {
  unit_price: number;
  scope: string;
  is_included: boolean;
}

/** Un ítem del carrito público (home y /cotizar comparten esta forma). */
export interface CartItemInput {
  quantity: number;
  base_unit_price?: number;
  unit_price?: number;
  _components?: CartComponentInput[] | null;
  labor_price?: number;      has_labor?: boolean;      labor_scope?: string;
  design_price?: number;     has_design?: boolean;     design_scope?: string;
  transport_price?: number;  has_transport?: boolean;  transport_scope?: string;
}

/**
 * Total de una línea del carrito. Es la contraparte pública EXACTA de
 * `buildItemLinesFromComponents`: si el ítem trae receta, la receta ES el
 * producto y la base no se suma. Home y /cotizar la usan las dos, y el
 * encabezado P.V. Unit sale de acá también, así que no pueden discrepar.
 */
export function cartLineTotal(it: CartItemInput): number {
  const qty = Math.max(1, Number(it.quantity) || 1);
  const comps = it._components;

  if (comps && comps.length > 0) {
    return round2(comps.reduce((acc, c) => {
      if (!c.is_included) return acc;
      const p = Number(c.unit_price) || 0;
      if (!(p > 0)) return acc;
      return acc + round2((c.scope === 'unit' ? qty : 1) * p);
    }, 0));
  }

  // Legado: sin receta, la base es el producto y los tres componentes se suman.
  const base = round2(qty * (Number(it.base_unit_price) || 0));
  const comp = (price: number | undefined, enabled: boolean | undefined, scope: string | undefined) => {
    if (enabled === false) return 0;
    const p = Number(price) || 0;
    if (!(p > 0)) return 0;
    return round2((scope === 'unit' ? qty : 1) * p);
  };
  return round2(
    base
    + comp(it.labor_price, it.has_labor, it.labor_scope)
    + comp(it.design_price, it.has_design, it.design_scope)
    + comp(it.transport_price, it.has_transport, it.transport_scope),
  );
}

/**
 * Precio unitario que se muestra en el encabezado del ítem: lo que cuesta UNA
 * unidad con lo que el cliente dejó tildado. Es la MISMA función que el
 * subtotal, evaluada a cantidad 1, para que el número de arriba y la suma del
 * desglose no puedan contarse distinto. Antes acá iba `base_unit_price`, que es
 * el precio de una PARTE (el producto sin mano de obra): 168.75 contra 195.75.
 */
export function cartUnitPrice(it: CartItemInput): number {
  return cartLineTotal({ ...it, quantity: 1 });
}
