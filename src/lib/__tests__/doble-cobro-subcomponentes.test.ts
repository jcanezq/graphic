// ============================================================
// El doble cobro de subcomponentes (SUBC) — caso real SRV-2026-0507
//
// Con receta cargada, `buildItemLinesFromComponents` emitía la fila `base`
// (el producto entero) Y una fila por cada subcomponente incluido. Como los
// subcomponentes SON el producto, la cotización lo cobraba dos veces:
// 364.50 en vez de 195.75. Un 86 % de sobrecobro.
//
// Por qué la suite anterior no lo cazaba: sus 24 pruebas entran por
// `createQuotationItemFromProduct` -> `itemSubtotal` (el motor LEGADO de
// has_labor/has_design/has_transport) y por una reimplementación a mano del
// carrito que ni siquiera tiene rama de `_components`. Ninguna llamaba nunca a
// `buildItemLinesFromComponents`, que es el motor que imprime el PDF, el Excel
// y el desglose de pantalla. El motor que cobraba de más no tenía una sola prueba.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  buildItemLinesFromComponents, itemSubtotalFromComponents, cartLineTotal, cartUnitPrice,
  type QuotationItemComponent,
} from '@/lib/pricing';
import {
  buildCatalogPricing, createQuotationItemFromProduct, buildQuotationItemLines,
  repriceItemFromComponents, calcQuotationTotals,
} from '@/lib/calculations';

const IGV = 0.18;

/**
 * «Exhibidores y POP - M2» (SRV-2026-0507), tal como está cargado en el
 * catálogo. Costo unitario 145.00, margen 35 % -> Precio Venta 195.75.
 */
const EXHIBIDOR: any = {
  id: 'p-507', code: 'SRV-2026-0507', name: 'Exhibidores y POP - M2',
  type: 'Servicio', unit: 'm2', description: '', manual_unit_cost: null,
  default_margin: 35, is_active: true, category_id: null, image_url: null,
  materials: [
    { name: 'Acrilico', quantity: 1, unit_cost: 35, unit: 'm2', material_id: null },
    { name: 'Vinil',    quantity: 1, unit_cost: 30, unit: 'm2', material_id: null },
  ],
  labor: [{ work_type: 'Ensamblaje', hours: 1, hourly_rate: 20, unit: 'hr' }],
  indirect_costs: [
    { concept: 'Corte y router',      kind: 'production', unit: 'm2',     quantity: 1, unit_cost: 20, cost: 20 },
    { concept: 'Impresion grafica',   kind: 'production', unit: 'm2',     quantity: 1, unit_cost: 15, cost: 15 },
    { concept: 'Instalacion/entrega', kind: 'other',      unit: 'global', quantity: 1, unit_cost: 25, cost: 25 },
  ],
};

/** El número que muestra el panel de administración (CostSummarySection). */
function precioVentaDelPanel(product: any) {
  return buildCatalogPricing(product, product.materials, product.labor, product.indirect_costs).unitPrice;
}

/** Lo que cobra el ítem: la suma de las filas que imprimen PDF, Excel y pantalla. */
function sumaDeFilas(item: any): number {
  return Math.round(buildQuotationItemLines(item).reduce((s, l) => s + l.subtotal, 0) * 100) / 100;
}

describe('SUBC — la receta ES el producto, no un extra', () => {

  it('el catalogo y la cotizacion parten del mismo costo: 145.00 -> 195.75', () => {
    expect(precioVentaDelPanel(EXHIBIDOR)).toBe(195.75);
  });

  // ---- EL DEFECTO ----
  it('un item con receta cobra 195.75, no 364.50 (la base duplicaba la receta)', () => {
    const item = createQuotationItemFromProduct(EXHIBIDOR, 1, 35, 0);
    expect(sumaDeFilas(item)).toBe(195.75);
  });

  it('con receta incluida no se imprime la fila base: las filas son los subcomponentes', () => {
    const item: any = createQuotationItemFromProduct(EXHIBIDOR, 1, 35, 0);
    const lines = buildQuotationItemLines(item);
    expect(lines).toHaveLength(6);
    expect(lines.some((l) => l.label === 'base')).toBe(false);
  });

  // ---- EL INVARIANTE QUE FALTABA ----
  // Dos pantallas, dos caminos de cálculo, nadie los cruzaba.
  it('INVARIANTE: subtotal de la cotizacion a cantidad 1 === Precio Venta del panel', () => {
    const item = createQuotationItemFromProduct(EXHIBIDOR, 1, 35, 0);
    expect(item.subtotal).toBe(precioVentaDelPanel(EXHIBIDOR));
    expect(sumaDeFilas(item)).toBe(precioVentaDelPanel(EXHIBIDOR));
  });

  it('el documento cuadra consigo mismo: el subtotal guardado === suma de sus filas', () => {
    for (const qty of [1, 2, 7]) {
      const item = createQuotationItemFromProduct(EXHIBIDOR, qty, 35, 0);
      expect(sumaDeFilas(item)).toBe(item.subtotal);
    }
  });

  it('el total con IGV del caso real es 230.99, no 430.11', () => {
    const item = createQuotationItemFromProduct(EXHIBIDOR, 1, 35, 0);
    expect(calcQuotationTotals([item] as any, IGV)).toEqual({
      subtotal: 195.75, igv: 35.24, total: 230.99,
    });
  });

  // ---- BORDE 1: todos los subcomponentes destildados ----
  it('sin ningun subcomponente incluido el item cobra 0 — la base NO reaparece', () => {
    const item: any = createQuotationItemFromProduct(EXHIBIDOR, 1, 35, 0);
    item._components = item._components.map((c: QuotationItemComponent) => ({ ...c, is_included: false }));
    const reprized: any = repriceItemFromComponents(item);
    expect(reprized.subtotal).toBe(0);
    expect(sumaDeFilas(reprized)).toBe(0);
    // El ítem sigue apareciendo en el documento, pero sin cobrar nada.
    const lines = buildQuotationItemLines(reprized);
    expect(lines).toHaveLength(1);
    expect(lines[0].unit_price).toBe(0);
    expect(lines[0].subtotal).toBe(0);
  });

  it('destildar un subcomponente BAJA el total (antes el interruptor era decorativo)', () => {
    const item: any = createQuotationItemFromProduct(EXHIBIDOR, 1, 35, 0);
    item._components = item._components.map((c: QuotationItemComponent) =>
      c.label === 'Instalacion/entrega' ? { ...c, is_included: false } : c);
    // 195.75 - 25 x 1.35 = 195.75 - 33.75
    expect(repriceItemFromComponents(item).subtotal).toBe(162.00);
  });

  // ---- BORDE 2: costo manual + receta ----
  it('con costo manual la receta NO se publica: manda el costo manual y el invariante aguanta', () => {
    const manual = { ...EXHIBIDOR, manual_unit_cost: 200 };
    const item: any = createQuotationItemFromProduct(manual, 1, 35, 0);
    // 200 x 1.35 = 270 (base) + 20 x 1.35 = 27 (mano de obra) = 297
    expect(item._components).toHaveLength(0);
    expect(item.subtotal).toBe(297.00);
    expect(item.subtotal).toBe(precioVentaDelPanel(manual));
    expect(sumaDeFilas(item)).toBe(item.subtotal);
  });

  // ---- NO-REGRESIÓN: sin receta la base sigue siendo el producto ----
  it('sin receta (lista vacia) la fila base sobrevive: representa el producto entero', () => {
    const lines = buildItemLinesFromComponents(2, 100, 30, 'unidad', []);
    expect(lines).toHaveLength(1);
    expect(lines[0].key).toBe('base');
    expect(lines[0].subtotal).toBe(260);
    expect(itemSubtotalFromComponents(2, 100, 30, 'unidad', [])).toBe(260);
  });

  // ---- Escalado unit / order con receta ----
  it('cantidad 3: los subcomponentes «unit» escalan y los «order» se cobran una vez', () => {
    const comps: QuotationItemComponent[] = [
      { sort_order: 0, category: 'material', source_kind: null, label: 'Vinil', unit: 'm2',
        quantity: 1, unit_cost: 100, margin_percent: 0, scope: 'unit', is_included: true },
      { sort_order: 1, category: 'production', source_kind: 'design', label: 'Diseno', unit: 'hr',
        quantity: 1, unit_cost: 50, margin_percent: 0, scope: 'order', is_included: true },
    ];
    // 3 x 100 + 1 x 50 = 350. La base (que valia 999) no entra.
    expect(itemSubtotalFromComponents(3, 999, 0, 'm2', comps)).toBe(350);
  });
});

describe('SUBC — el carrito publico calcula por el mismo camino que el servidor', () => {

  /** El ítem del carrito tal como lo arma /api/public/products + page.tsx. */
  function itemDeCarrito(qty: number) {
    const pricing = buildCatalogPricing(EXHIBIDOR, EXHIBIDOR.materials, EXHIBIDOR.labor, EXHIBIDOR.indirect_costs);
    const pv = (c: number) => Math.round(c * 1.35 * 100) / 100;
    return {
      quantity: qty,
      base_unit_price: pricing.baseUnitPrice,
      labor_price: pricing.laborPrice, has_labor: true, labor_scope: 'unit',
      design_price: pricing.designPrice, has_design: true, design_scope: 'order',
      transport_price: pricing.transportPrice, has_transport: true, transport_scope: 'order',
      _components: [
        { label: 'Acrilico',            unit_price: pv(35), scope: 'unit', is_included: true },
        { label: 'Vinil',               unit_price: pv(30), scope: 'unit', is_included: true },
        { label: 'Ensamblaje',          unit_price: pv(20), scope: 'unit', is_included: true },
        { label: 'Corte y router',      unit_price: pv(20), scope: 'unit', is_included: true },
        { label: 'Impresion grafica',   unit_price: pv(15), scope: 'unit', is_included: true },
        { label: 'Instalacion/entrega', unit_price: pv(25), scope: 'unit', is_included: true },
      ],
    };
  }

  it('el carrito muestra 195.75, no 364.50', () => {
    expect(cartLineTotal(itemDeCarrito(1) as any)).toBe(195.75);
  });

  it('el P.V. Unit del encabezado es el precio del producto entero, no el de la base', () => {
    // Antes mostraba 168.75 (base sin mano de obra) mientras el desglose sumaba otra cosa.
    expect(cartUnitPrice(itemDeCarrito(1) as any)).toBe(195.75);
    expect(cartUnitPrice(itemDeCarrito(9) as any)).toBe(195.75);
  });

  it('el encabezado y el desglose no pueden discrepar: a cantidad 1 son el mismo numero', () => {
    const it1 = itemDeCarrito(1) as any;
    expect(cartUnitPrice(it1)).toBe(cartLineTotal(it1));
  });

  it('carrito y servidor dan el mismo subtotal (C-1 no vuelve por la puerta de SUBC)', () => {
    for (const qty of [1, 3, 10]) {
      const servidor = createQuotationItemFromProduct(EXHIBIDOR, qty, 35, 0);
      expect(cartLineTotal(itemDeCarrito(qty) as any)).toBe(servidor.subtotal);
    }
  });

  it('el carrito sin receta cae al camino legado y no cambia de precio', () => {
    const legado: any = { ...itemDeCarrito(3), _components: [] };
    expect(cartLineTotal(legado)).toBe(195.75 + 2 * 168.75 + 2 * 27);
  });
});
