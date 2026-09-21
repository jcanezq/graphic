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
  round2,
} from '@/lib/pricing';
import { buildPublicComponents } from '@/lib/public-catalog';
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

/**
 * Modulo de melamina del catalogo real. Margen 35 %. ES EL CASO QUE DESTAPO
 * EL DEFECTO, y esta aca por lo que tiene de distinto: una cantidad que NO es 1.
 *
 *   Tablero melamine 18mm   m2         1 x 140.00 = 140.00
 *   Cantos / tapacantos     m lineal   4 x   1.20 =   4.80   <- los 4 m lineales
 *   Herrajes                juego      1 x  40.00 =  40.00
 *                                             costo  184.80 -> P. Venta 249.48
 *
 * El invariante de arriba corria SOLO contra EXHIBIDOR, donde las seis
 * cantidades valen 1. Un defecto que pierde la cantidad es invisible contra un
 * fixture donde la cantidad no hace nada: la prueba pasaba multiplicando por 1
 * un numero que el codigo nunca multiplicaba.
 */
const MELAMINA: any = {
  id: 'p-mel', code: 'PRD-2026-0921', name: 'Modulo de melamina',
  type: 'Producto', unit: 'unidad', description: '', manual_unit_cost: null,
  default_margin: 35, is_active: true, category_id: null, image_url: null,
  materials: [
    { name: 'Tablero melamine 18mm', quantity: 1, unit_cost: 140,  unit: 'm2',       material_id: null },
    { name: 'Cantos / tapacantos',   quantity: 4, unit_cost: 1.20, unit: 'm lineal', material_id: null },
    { name: 'Herrajes',              quantity: 1, unit_cost: 40,   unit: 'juego',    material_id: null },
  ],
  labor: [],
  indirect_costs: [],
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
    // Corre sobre los DOS fixtures: uno con todas las cantidades en 1 y otro con
    // los 4 m lineales de canto. El primero solo no prueba nada sobre cantidades.
    for (const producto of [EXHIBIDOR, MELAMINA]) {
      const item = createQuotationItemFromProduct(producto, 1, 35, 0);
      expect(item.subtotal).toBe(precioVentaDelPanel(producto));
      expect(sumaDeFilas(item)).toBe(precioVentaDelPanel(producto));
    }
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

  /**
   * El ítem del carrito tal como lo arma /api/public/products + page.tsx.
   *
   * ⚠ LA RECETA SALE DE `buildPublicComponents`, la MISMA función que publica el
   * servidor. Antes esta lista estaba escrita a mano, con seis precios a dedo, y
   * por eso el test no se enteró de que el catálogo publicaba los componentes
   * sin su cantidad: la copia a mano tampoco la tenía, así que las dos estaban
   * de acuerdo en el error.
   */
  function itemDeCarrito(product: any, qty: number) {
    const pricing = buildCatalogPricing(product, product.materials, product.labor, product.indirect_costs);
    return {
      quantity: qty,
      base_unit_price: pricing.baseUnitPrice,
      labor_price: pricing.laborPrice, has_labor: true, labor_scope: 'unit',
      design_price: pricing.designPrice, has_design: true, design_scope: 'order',
      transport_price: pricing.transportPrice, has_transport: true, transport_scope: 'order',
      _components: buildPublicComponents(product, product.materials, product.labor, product.indirect_costs)
        .map((c) => ({ ...c, is_included: true })),
    };
  }

  /** Un solo subcomponente del catálogo, en un carrito de una unidad. */
  function soloEsteComponente(product: any, label: string, qty: number = 1) {
    const c = buildPublicComponents(product, product.materials, product.labor, product.indirect_costs)
      .find((x) => x.label === label);
    if (!c) throw new Error(`El catálogo público no publica «${label}»`);
    return { quantity: qty, _components: [{ ...c, is_included: true }] };
  }

  it('el carrito muestra 195.75, no 364.50', () => {
    expect(cartLineTotal(itemDeCarrito(EXHIBIDOR, 1) as any)).toBe(195.75);
  });

  it('el P.V. Unit del encabezado es el precio del producto entero, no el de la base', () => {
    // Antes mostraba 168.75 (base sin mano de obra) mientras el desglose sumaba otra cosa.
    expect(cartUnitPrice(itemDeCarrito(EXHIBIDOR, 1) as any)).toBe(195.75);
    expect(cartUnitPrice(itemDeCarrito(EXHIBIDOR, 9) as any)).toBe(195.75);
  });

  it('el encabezado y el desglose no pueden discrepar: a cantidad 1 son el mismo numero', () => {
    const it1 = itemDeCarrito(EXHIBIDOR, 1) as any;
    expect(cartUnitPrice(it1)).toBe(cartLineTotal(it1));
  });

  it('carrito y servidor dan el mismo subtotal (C-1 no vuelve por la puerta de SUBC)', () => {
    for (const qty of [1, 3, 10]) {
      const servidor = createQuotationItemFromProduct(EXHIBIDOR, qty, 35, 0);
      expect(cartLineTotal(itemDeCarrito(EXHIBIDOR, qty) as any)).toBe(servidor.subtotal);
    }
  });

  it('el carrito sin receta cae al camino legado y no cambia de precio', () => {
    const legado: any = { ...itemDeCarrito(EXHIBIDOR, 3), _components: [] };
    expect(cartLineTotal(legado)).toBe(195.75 + 2 * 168.75 + 2 * 27);
  });

  // ============================================================
  // LA CANTIDAD DE LA RECETA — el caso de los 4 m lineales de canto
  //
  // El costo de un componente se calcula con su SUBTOTAL (cantidad x costo
  // unitario), no con su costo unitario. El catálogo público publicaba el costo
  // unitario y tiraba la cantidad, así que el carrito cobraba UN metro de canto
  // donde la receta dice CUATRO. El servidor, al guardar, sí copia la cantidad
  // (`createQuotationItemFromProduct` hace `quantity: m.quantity`): el cliente
  // aceptaba un número y se le facturaba otro.
  // ============================================================

  it('el catalogo publica los 4 m lineales de canto, no 1', () => {
    const comps = buildPublicComponents(MELAMINA, MELAMINA.materials, MELAMINA.labor, MELAMINA.indirect_costs);
    const cantos = comps.find((c) => c.label === 'Cantos / tapacantos')!;
    expect(cantos.quantity).toBe(4);
    expect(cantos.unit).toBe('m lineal');
    expect(cantos.unit_price).toBe(1.62);   // 1.20 x 1.35, el precio de UN metro
  });

  it('la linea de cantos vale 6.48 (4 x 1.20 x 1.35), no 1.62', () => {
    expect(cartLineTotal(soloEsteComponente(MELAMINA, 'Cantos / tapacantos') as any)).toBe(6.48);
  });

  it('la cantidad de la receta escala con la del item: 3 modulos son 12 m lineales', () => {
    expect(cartLineTotal(soloEsteComponente(MELAMINA, 'Cantos / tapacantos', 3) as any)).toBe(19.44);
  });

  it('INVARIANTE: a cantidad 1 el carrito muestra el Precio Venta del panel', () => {
    for (const producto of [EXHIBIDOR, MELAMINA]) {
      expect(cartUnitPrice(itemDeCarrito(producto, 1) as any)).toBe(precioVentaDelPanel(producto));
    }
  });

  it('INVARIANTE: lo que ve el cliente en el carrito === lo que guarda el servidor', () => {
    // Esta es la que importa: el carrito decía 244.62 y la cotización guardada
    // 249.48. La diferencia son exactamente los 3 m lineales de canto que el
    // catálogo no publicaba.
    for (const producto of [EXHIBIDOR, MELAMINA]) {
      for (const qty of [1, 3, 10]) {
        const servidor = createQuotationItemFromProduct(producto, qty, 35, 0);
        expect(cartLineTotal(itemDeCarrito(producto, qty) as any)).toBe(servidor.subtotal);
      }
    }
  });

  it('la receta publicada y la guardada describen la MISMA fila, campo por campo', () => {
    // No alcanza con que los totales coincidan: si el catálogo publicara «1 m
    // lineal a S/ 6.48» y el servidor guardara «4 m lineales a S/ 1.62», el
    // dinero cuadraría y el documento diría dos cosas distintas.
    // (Las dos listas tienen el mismo largo porque toda fila de estos fixtures
    // cuesta > 0; el catálogo público omite las de costo cero.)
    for (const producto of [EXHIBIDOR, MELAMINA]) {
      const publicadas = buildPublicComponents(
        producto, producto.materials, producto.labor, producto.indirect_costs);
      const guardadas: QuotationItemComponent[] =
        (createQuotationItemFromProduct(producto, 1, 35, 0) as any)._components;
      expect(publicadas.map((c) => [c.label, c.unit, c.quantity, c.scope, c.category, c.source_kind]))
        .toEqual(guardadas.map((c) => [c.label, c.unit ?? 'unidad', c.quantity, c.scope, c.category, c.source_kind]));
    }
  });

  it('un componente de scope «order» tampoco pierde su cantidad', () => {
    // El scope decide si la fila escala con el ítem, no si tiene cantidad. Dos
    // horas de diseño son dos horas aunque se cobren una sola vez por pedido.
    const conDiseno: any = {
      ...MELAMINA,
      indirect_costs: [
        { concept: 'Diseno grafico', kind: 'design', unit: 'hr', quantity: 2, unit_cost: 30, cost: 60 },
      ],
    };
    const diseno = soloEsteComponente(conDiseno, 'Diseno grafico', 5) as any;
    expect(diseno._components[0].scope).toBe('order');
    // 2 hr x 30 x 1.35 = 81.00, y no se multiplica por los 5 modulos.
    expect(cartLineTotal(diseno)).toBe(81);
    expect(cartLineTotal(itemDeCarrito(conDiseno, 5) as any))
      .toBe(createQuotationItemFromProduct(conDiseno, 5, 35, 0).subtotal);
  });
});
