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
