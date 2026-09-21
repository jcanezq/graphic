// ============================================================
// SUBC-T5 · Un subcomponente destildado no se cobra, y lo que cambió se avisa
//
// EL DEFECTO, por cuarta puerta distinta. El cliente destilda una fila en
// /cotizar, ve bajar el total, acepta — y la cotización guardada se lo cobra
// igual. Dos causas encadenadas:
//
//   1. `/cotizar` mandaba `product_id`, `quantity` y los tres interruptores
//      legados, y NADA sobre los subcomponentes destildados.
//   2. Aunque los mandara, el filtro del servidor era inerte:
//        is_included: c.id !== undefined ? includedIds.includes(c.id) : true
//      Los subcomponentes que el servidor acaba de reconstruir del catálogo
//      NO tienen `id` todavía —el id nace al insertarlos en
//      `quotation_item_components`—, así que la condición caía SIEMPRE en el
//      `true` y todo se cobraba. Medido antes del arreglo: con la lista de
//      incluidos VACÍA el subtotal seguía siendo 195.75 en vez de 162.00.
//
// LA IDENTIDAD DE LA FILA. Hace falta una clave estable para una fila que
// todavía no tiene `id`. `sort_order` no sirve: si alguien agrega un material a
// la receta entre que el cliente carga la página y envía, las posiciones se
// corren y el cliente excluiría la fila equivocada. La clave es
// DETERMINÍSTICA POR CONTENIDO — `categoría:source_kind:etiqueta` — y la
// calcula UNA sola función (`buildComponentRowKeys`) que llaman los dos lados.
//
// LA REGLA §7.12 NO SE TOCA: el cliente manda QUÉ FILAS quiere, nunca cuánto
// valen. El total que aceptó viaja SÓLO para comparar.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  componentRowKey, buildComponentRowKeys, applyClientComponentSelection,
  buildPriceNotice, toClientComponentSelection,
} from '@/lib/component-selection';
import { buildPublicComponents } from '@/lib/public-catalog';
import { createQuotationItemFromProduct, calcQuotationTotals } from '@/lib/calculations';
import { clientQuotationSchema, clientQuotationItemSchema } from '@/lib/validations/api';
import { round2 } from '@/lib/pricing';

const IGV = 0.18;

/**
 * «Exhibidores y POP - M2» (SRV-2026-0507), el mismo fixture de SUBC-T3/T4.
 * Costo 145.00, margen 35 % -> 195.75. Su desglose a cantidad 1:
 *
 *   material::acrilico              47.25
 *   material::vinil                 40.50
 *   labor::ensamblaje               27.00
 *   production::corte y router      27.00
 *   production::impresion grafica   20.25
 *   other::instalacion/entrega      33.75   <- la que el cliente destilda
 *                                  ------
 *                                  195.75
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

const INSTALACION = 'other::instalacion/entrega';

/** El producto tal como lo publica el catálogo público (lo que ve el cliente). */
function comoLoVeElCliente(product: any) {
  return buildPublicComponents(product, product.materials, product.labor, product.indirect_costs);
}

/** El carrito del cliente: la receta pública con sus interruptores. */
function carrito(product: any, destildadas: string[] = []) {
  return comoLoVeElCliente(product).map((c) => ({
    ...c,
    is_included: !destildadas.includes(c.key),
  }));
}

/**
 * Lo que hace el servidor con una línea: reconstruye el ítem del catálogo
 * vigente y le aplica la selección del cliente. Es la MISMA función que llama
 * `/api/client/quotations`, no una copia (ver la prueba de cableado de abajo).
 */
function comoGuardaElServidor(product: any, seleccion: any, qty = 1) {
  const snap = createQuotationItemFromProduct(product, qty, product.default_margin, 0);
  const r = applyClientComponentSelection(snap as any, toSeleccion(seleccion));
  return { ...r, totals: calcQuotationTotals([r.item] as any, IGV) };
}

/** Traduce un carrito de prueba a lo que viaja por la red. */
function toSeleccion(carritoODirecto: any) {
  if (carritoODirecto == null) return carritoODirecto;
  return toClientComponentSelection(carritoODirecto);
}

describe('SUBC-T5 — la clave de una fila que todavía no tiene id', () => {

  it('la clave sale del CONTENIDO, no de la posición', () => {
    expect(componentRowKey({ category: 'other', source_kind: null, label: 'Instalacion/entrega' }))
      .toBe(INSTALACION);
    expect(componentRowKey({ category: 'production', source_kind: 'design', label: 'Diseño gráfico' }))
      .toBe('production:design:diseño gráfico');
  });

  it('agregar una fila ANTES no le cambia la clave a las de abajo (lo que sort_order no puede prometer)', () => {
    const aFila = (m: any) => ({ category: 'material', source_kind: null, label: m.name });
    const antes = buildComponentRowKeys(EXHIBIDOR.materials.map(aFila));
    const despues = buildComponentRowKeys([{ name: 'Tornilleria' }, ...EXHIBIDOR.materials].map(aFila));
    expect(antes).toEqual(['material::acrilico', 'material::vinil']);
    expect(despues.slice(1)).toEqual(antes);   // las viejas conservan SU clave
  });

  // COLISIÓN: dos filas de la MISMA receta con la misma categoría y etiqueta.
  it('dos filas idénticas no comparten clave: la repetida lleva sufijo de aparición', () => {
    const claves = buildComponentRowKeys([
      { category: 'material', source_kind: null, label: 'Vinil' },
      { category: 'material', source_kind: null, label: 'Acrilico' },
      { category: 'material', source_kind: null, label: 'Vinil' },
    ]);
    expect(claves).toEqual(['material::vinil', 'material::acrilico', 'material::vinil#2']);
  });

  it('destildar la SEGUNDA de dos filas homónimas apaga esa y sólo esa', () => {
    const dosViniles = {
      ...EXHIBIDOR,
      materials: [
        { name: 'Vinil', quantity: 1, unit_cost: 30, unit: 'm2' },
        { name: 'Vinil', quantity: 1, unit_cost: 10, unit: 'm2' },
      ],
      labor: [], indirect_costs: [],
    };
    const { item } = comoGuardaElServidor(dosViniles, carrito(dosViniles, ['material::vinil#2']));
    const comps: any[] = (item as any)._components;
    expect(comps.map((c) => c.is_included)).toEqual([true, false]);
    expect(item.subtotal).toBe(40.50);   // sólo el de 30.00 de costo
  });

  // EL CONTRATO QUE SOSTIENE TODO: la clave que publica el catálogo es la misma
  // que calcula el servidor al reconstruir el ítem. Si divergen, el cliente
  // apaga una fila y el servidor apaga otra.
  it('CONTRATO: la clave publicada === la clave que calcula el servidor', () => {
    const publicadas = comoLoVeElCliente(EXHIBIDOR).map((c) => c.key);
    const item: any = createQuotationItemFromProduct(EXHIBIDOR, 1, 35, 0);
    const delServidor = buildComponentRowKeys(item._components);
    expect(publicadas).toEqual(delServidor);
  });

  it('una fila de costo cero no se publica pero no corre las claves de las demás', () => {
    const conRegalo = {
      ...EXHIBIDOR,
      materials: [{ name: 'Cinta de regalo', quantity: 1, unit_cost: 0, unit: 'u' }, ...EXHIBIDOR.materials],
    };
    const item: any = createQuotationItemFromProduct(conRegalo, 1, 35, 0);
    const delServidor = buildComponentRowKeys(item._components);
    const publicadas = comoLoVeElCliente(conRegalo).map((c) => c.key);
    // El catálogo público no publica la fila gratis; el servidor sí la guarda.
    expect(publicadas).not.toContain('material::cinta de regalo');
    expect(delServidor).toContain('material::cinta de regalo');
    // Y aun así todas las claves publicadas coinciden con las del servidor.
    expect(publicadas.every((k) => delServidor.includes(k))).toBe(true);
  });
});

describe('SUBC-T5 — el caso central: lo destildado no se cobra', () => {

  it('EL DEFECTO: destildar «Instalacion/entrega» baja el total guardado a 162.00', () => {
    const { totals } = comoGuardaElServidor(EXHIBIDOR, carrito(EXHIBIDOR, [INSTALACION]));
    expect(totals.subtotal).toBe(162.00);     // antes del arreglo: 195.75
    expect(totals.total).toBe(191.16);
  });

  it('lo que el cliente aceptó en pantalla y lo que se guarda es el MISMO número', () => {
    const delCarrito = carrito(EXHIBIDOR, [INSTALACION])
      .filter((c) => c.is_included)
      .reduce((s, c) => s + round2(c.quantity * c.unit_price), 0);
    const { totals } = comoGuardaElServidor(EXHIBIDOR, carrito(EXHIBIDOR, [INSTALACION]));
    expect(totals.subtotal).toBe(round2(delCarrito));
  });

  it('la fila destildada se PERSISTE apagada, no se borra: el documento la muestra en cero', () => {
    const { item } = comoGuardaElServidor(EXHIBIDOR, carrito(EXHIBIDOR, [INSTALACION]));
    const comps: any[] = (item as any)._components;
    expect(comps).toHaveLength(6);
    expect(comps.find((c) => c.label === 'Instalacion/entrega').is_included).toBe(false);
    expect(comps.filter((c) => c.is_included)).toHaveLength(5);
  });

  it('sin selección (cliente viejo) no se cambia nada: todo incluido, como antes', () => {
    const { item, added, missing } = comoGuardaElServidor(EXHIBIDOR, null);
    expect((item as any)._components.every((c: any) => c.is_included)).toBe(true);
    expect(added).toEqual([]);
    expect(missing).toEqual([]);
  });

  it('destildar TODO no cobra nada, y no resucita la fila base', () => {
    const todas = comoLoVeElCliente(EXHIBIDOR).map((c) => c.key);
    const { totals } = comoGuardaElServidor(EXHIBIDOR, carrito(EXHIBIDOR, todas));
    expect(totals.subtotal).toBe(0);
  });
});

describe('SUBC-T5 — el catálogo cambió: se cobra bien Y se avisa', () => {

  /** El cliente armó el carrito cuando el producto NO tenía «Instalacion/entrega». */
  const VIEJO = { ...EXHIBIDOR, indirect_costs: EXHIBIDOR.indirect_costs.slice(0, 2) };

  it('un componente que el cliente nunca vio SE COBRA (precio real del catálogo vigente)', () => {
    const { totals } = comoGuardaElServidor(EXHIBIDOR, carrito(VIEJO));
    expect(totals.subtotal).toBe(195.75);   // la fila nueva entra, no se regala
  });

  it('...y la respuesta lo DICE: la otra mitad del trato', () => {
    const { added, totals } = comoGuardaElServidor(EXHIBIDOR, carrito(VIEJO));
    expect(added).toEqual(['Instalacion/entrega']);

    const aceptado = comoGuardaElServidor(VIEJO, carrito(VIEJO)).totals.total;
    const aviso = buildPriceNotice(aceptado, totals.total, [
      { item: EXHIBIDOR.name, added, missing: [] },
    ]);
    expect(aviso).not.toBeNull();
    expect(aviso!.accepted_total).toBe(191.16);
    expect(aviso!.total).toBe(230.99);
    expect(aviso!.difference).toBe(39.83);
    expect(aviso!.changes[0].added).toEqual(['Instalacion/entrega']);
  });

  it('un precio que subió sin cambiar la receta también se avisa', () => {
    const masCaro = {
      ...EXHIBIDOR,
      materials: [{ ...EXHIBIDOR.materials[0], unit_cost: 50 }, EXHIBIDOR.materials[1]],
    };
    const { totals, added, missing } = comoGuardaElServidor(masCaro, carrito(EXHIBIDOR));
    expect(added).toEqual([]);          // la receta es la misma
    expect(missing).toEqual([]);
    const aviso = buildPriceNotice(230.99, totals.total, [{ item: masCaro.name, added, missing }]);
    expect(aviso).not.toBeNull();       // el aviso lo dispara la PLATA, no la receta
    expect(aviso!.difference).toBe(23.89);
  });

  it('sin cambios no hay aviso: un cartel que sale siempre no lo lee nadie', () => {
    const { totals, added, missing } = comoGuardaElServidor(EXHIBIDOR, carrito(EXHIBIDOR, [INSTALACION]));
    expect(buildPriceNotice(totals.total, totals.total, [{ item: EXHIBIDOR.name, added, missing }])).toBeNull();
  });

  it('un cliente que no manda el total aceptado igual recibe el aviso del componente nuevo', () => {
    const { added } = comoGuardaElServidor(EXHIBIDOR, carrito(VIEJO));
    const aviso = buildPriceNotice(null, 230.99, [{ item: EXHIBIDOR.name, added, missing: [] }]);
    expect(aviso).not.toBeNull();
    expect(aviso!.difference).toBeNull();
  });
});

describe('SUBC-T5 — el caso inverso: la fila destildada ya no existe', () => {

  it('una clave que el catálogo ya no tiene no rompe nada', () => {
    const seleccion = [
      ...toClientComponentSelection(carrito(EXHIBIDOR)),
      { key: 'material::vinil arena', included: false },
    ];
    const snap = createQuotationItemFromProduct(EXHIBIDOR, 1, 35, 0);
    const { item, added, missing } = applyClientComponentSelection(snap as any, seleccion);
    expect(calcQuotationTotals([item] as any, IGV).subtotal).toBe(195.75);
    expect(added).toEqual([]);
    expect(missing).toEqual(['material::vinil arena']);
  });

  it('una fila destildada que desapareció NO levanta el cartel por sí sola: no cambia la plata', () => {
    const seleccion = [
      ...toClientComponentSelection(carrito(EXHIBIDOR, [INSTALACION])),
      { key: 'material::vinil arena', included: false },
    ];
    const snap = createQuotationItemFromProduct(EXHIBIDOR, 1, 35, 0);
    const { item, added, missing } = applyClientComponentSelection(snap as any, seleccion);
    const totals = calcQuotationTotals([item] as any, IGV);
    expect(missing).toEqual(['material::vinil arena']);
    expect(buildPriceNotice(totals.total, totals.total, [{ item: EXHIBIDOR.name, added, missing }])).toBeNull();
  });

  it('una selección vacía no apaga nada: son todas filas que el cliente no vio', () => {
    const snap = createQuotationItemFromProduct(EXHIBIDOR, 1, 35, 0);
    const { item, added } = applyClientComponentSelection(snap as any, []);
    expect(calcQuotationTotals([item] as any, IGV).subtotal).toBe(195.75);
    expect(added).toHaveLength(6);
  });
});

describe('SUBC-T5 — §7.12: el cuerpo no mueve el precio', () => {

  it('un costo y un margen puestos a mano en el ítem se DESCARTAN al validar', () => {
    const parsed = clientQuotationItemSchema.parse({
      product_id: '11111111-1111-4111-8111-111111111111',
      quantity: 1,
      unit_cost: 0.01,
      margin_percent: 999,
      subtotal: 1,
    } as any);
    expect(parsed).not.toHaveProperty('unit_cost');
    expect(parsed).not.toHaveProperty('margin_percent');
    expect(parsed).not.toHaveProperty('subtotal');
  });

  it('una entrada de la selección sólo puede traer la clave y el interruptor', () => {
    const parsed = clientQuotationItemSchema.parse({
      product_id: '11111111-1111-4111-8111-111111111111',
      quantity: 1,
      component_selection: [{ key: 'material::vinil', included: false, unit_price: 0.01, quantity: 1 }],
    } as any);
    expect(parsed.component_selection![0]).toEqual({ key: 'material::vinil', included: false });
  });

  it('el total aceptado es SÓLO para comparar: no entra en la aritmética', () => {
    const conMentira = comoGuardaElServidor(EXHIBIDOR, carrito(EXHIBIDOR, [INSTALACION]));
    // El mismo cálculo, con un total aceptado absurdo, da el mismo dinero.
    expect(conMentira.totals.subtotal).toBe(162.00);
    const aviso = buildPriceNotice(1, conMentira.totals.total, [{ item: EXHIBIDOR.name, added: [], missing: [] }]);
    expect(aviso!.total).toBe(191.16);        // el precio real manda
    expect(aviso!.accepted_total).toBe(1);    // el número del cliente sólo se REPITE
  });

  it('el cuerpo entero valida con el total aceptado y la selección', () => {
    const body = clientQuotationSchema.parse({
      client_name: 'Acme', client_phone: '999999999',
      accepted_total: 191.16,
      items: [{
        product_id: '11111111-1111-4111-8111-111111111111',
        quantity: 1,
        component_selection: [{ key: INSTALACION, included: false }],
      }],
    } as any);
    expect(body.accepted_total).toBe(191.16);
    expect(body.items[0].component_selection).toHaveLength(1);
  });
});

describe('SUBC-T5 — cableado: la función existe Y alguien la llama', () => {

  const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8');

  it('el servidor aplica la selección con la función compartida, no con una copia', () => {
    const fuente = leer('src/app/api/client/quotations/route.ts');
    expect(fuente).toContain('applyClientComponentSelection');
    expect(fuente).toContain('buildPriceNotice');
    // El filtro inerte por `id` no puede volver.
    expect(fuente).not.toContain('included_component_ids');
  });

  it('el carrito manda la selección y el total que el cliente aceptó', () => {
    const fuente = leer('src/app/cotizar/page.tsx');
    expect(fuente).toContain('toClientComponentSelection');
    expect(fuente).toContain('accepted_total');
  });

  it('el catálogo público publica la clave de cada subcomponente', () => {
    expect(comoLoVeElCliente(EXHIBIDOR).every((c) => typeof c.key === 'string' && c.key.length > 0)).toBe(true);
  });

  it('el carrito traduce sus subcomponentes a la selección que entiende el servidor', () => {
    const seleccion = toClientComponentSelection(carrito(EXHIBIDOR, [INSTALACION]));
    expect(seleccion).toHaveLength(6);
    expect(seleccion.find((s) => s.key === INSTALACION)!.included).toBe(false);
    expect(seleccion.every((s) => Object.keys(s).sort().join() === 'included,key')).toBe(true);
  });

  it('un borrador guardado ANTES del arreglo (sin clave) se traduce igual', () => {
    const viejo = comoLoVeElCliente(EXHIBIDOR).map(({ key, ...resto }) => ({
      ...resto,
      is_included: resto.label !== 'Instalacion/entrega',
    }));
    const seleccion = toClientComponentSelection(viejo as any);
    expect(seleccion.find((s) => s.key === INSTALACION)!.included).toBe(false);
  });
});
