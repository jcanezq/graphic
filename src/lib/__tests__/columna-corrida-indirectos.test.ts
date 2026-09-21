// ============================================================
// La columna corrida de IndirectCostsSection — y por qué toca el dinero
//
// El encabezado emitía la columna condicional (DISEÑO / TRANSPORTE) como 2.ª
// columna y la fila la emitía como 6.ª celda. Todo el cuerpo de esas dos tablas
// aparecía corrido una columna respecto de su rótulo, y la casilla que clasifica
// una fila como diseño o transporte se mostraba bajo el rótulo SUBTOTAL: nadie
// la marcaba sabiendo qué hacía. De ahí que `designCost` y `transportCost`
// valgan cero en productos que sí tienen diseño y transporte cargados.
//
// El repo no tiene entorno DOM (vitest corre en 'node', sin jsdom ni
// testing-library), así que la alineación se comprueba sobre el ORDEN DE EMISIÓN
// del propio componente. Es menos elegante que montar la tabla, pero caza
// exactamente la regresión: que la celda deje de salir donde sale su rótulo.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FUENTE = readFileSync(
  resolve(process.cwd(), 'src/components/products/IndirectCostsSection.tsx'),
  'utf-8',
);

const [, cabecera = '', cuerpo = ''] = FUENTE.match(/<thead>([\s\S]*?)<\/thead>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/) ?? [];

/** Posición de cada marca en el texto, o -1 si no aparece. */
const pos = (texto: string, marca: string) => texto.indexOf(marca);

describe('IndirectCostsSection — la casilla va bajo su propio rótulo', () => {

  it('la tabla se pudo leer (si esto falla, el resto no prueba nada)', () => {
    expect(cabecera.length).toBeGreaterThan(0);
    expect(cuerpo.length).toBeGreaterThan(0);
  });

  it('en el ENCABEZADO la columna condicional va entre CONCEPTO y UNIDAD', () => {
    const concepto = pos(cabecera, 'CONCEPTO');
    const condicional = pos(cabecera, 'componentLabel.toUpperCase()');
    const unidad = pos(cabecera, 'UNIDAD');
    expect(concepto).toBeGreaterThanOrEqual(0);
    expect(condicional).toBeGreaterThan(concepto);
    expect(unidad).toBeGreaterThan(condicional);
  });

  it('en la FILA la casilla va en esa misma posición: después del concepto y antes de la unidad', () => {
    const concepto = pos(cuerpo, '.concept` as const');
    const casilla = pos(cuerpo, '.is_component` as const');
    const unidad = pos(cuerpo, '.unit` as const');
    expect(concepto).toBeGreaterThanOrEqual(0);
    expect(casilla).toBeGreaterThan(concepto);
    // ANTES fallaba acá: la casilla se emitía después del subtotal, quinta celda
    // más allá de donde su rótulo la anunciaba.
    expect(unidad).toBeGreaterThan(casilla);
  });

  it('la casilla NO queda bajo el rótulo SUBTOTAL', () => {
    const casilla = pos(cuerpo, '.is_component` as const');
    const subtotal = pos(cuerpo, 'formatCurrency(qty * uCost)');
    expect(subtotal).toBeGreaterThan(casilla);
  });

  it('el encabezado y la fila declaran la misma cantidad de columnas', () => {
    const thsFijos = (cabecera.match(/<th\b/g) ?? []).length;      // 6 fijos + 1 condicional
    const tdsFijos = (cuerpo.match(/<td\b/g) ?? []).length;        // 5 fijos + acciones + 1 condicional
    expect(thsFijos).toBe(tdsFijos);
  });
});
