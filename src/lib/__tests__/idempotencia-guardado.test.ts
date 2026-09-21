// ============================================================
// SUBC-T3 · Guardar una cotización sin tocarla no puede cambiarla
//
// EL DEFECTO. `replace_quotation_items` hace DELETE de los ítems y los
// reinserta. `quotation_item_components.quotation_item_id` es ON DELETE
// CASCADE, y la lista de inserción del RPC no escribe un solo subcomponente.
// O sea: una cotización nace con su receta bien guardada y, en cuanto alguien
// la abre en el panel y aprieta Guardar —aunque no cambie nada—, la receta
// desaparece. A partir de ahí el ítem cae al motor legado, el desglose impreso
// cambia y el subtotal guardado queda sin nada que lo justifique.
//
// Es el mismo doble cobro que arregló `b1707fd`, entrando por la otra puerta:
// sin receta, `buildQuotationItemLines` vuelve al motor de has_labor /
// has_design / has_transport, que cobra la base ENTERA más los componentes.
//
// CÓMO SE PRUEBA SIN BASE DE DATOS. Abajo hay una base en memoria con los DOS
// hechos del esquema que importan: los ítems cuelgan de la cotización y los
// subcomponentes cuelgan del ítem EN CASCADA. `rpcReplaceQuotationItems` es el
// gemelo en JS del contrato del RPC: aplica el payload que recibe. El camino de
// guardado que se ejercita es el REAL (`saveQuotationItems`), no una réplica.
//
// Y para que el gemelo no se despegue del SQL de verdad, las dos primeras
// pruebas leen la migración vigente y le exigen que reinserte la receta.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createQuotationItemFromProduct, buildQuotationItemLines, calcQuotationTotals } from '@/lib/calculations';
import { toQuotationItemRow } from '@/lib/quotation-item-row';
import { saveQuotationItems } from '@/lib/quotation-save';
import type { QuotationItemComponent } from '@/lib/pricing';

const IGV = 0.18;

/** Los campos que DEFINEN una receta. Si uno no se persiste, la foto miente. */
const CAMPOS_DE_RECETA = [
  'quotation_item_id', 'sort_order', 'category', 'source_kind', 'label', 'unit',
  'quantity', 'unit_cost', 'margin_percent', 'scope', 'is_included',
] as const;

/** «Exhibidores y POP - M2» (SRV-2026-0507). Costo 145.00, margen 35 % -> 195.75. */
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

// ------------------------------------------------------------
// Base de datos en memoria
// ------------------------------------------------------------

type Fila = Record<string, any>;
interface BaseFalsa { items: Fila[]; components: Fila[] }

let seq = 0;
const nuevaBase = (): BaseFalsa => ({ items: [], components: [] });

/**
 * Gemelo en JS del RPC `replace_quotation_items`. Contrato:
 *   1. borra los ítems de la cotización — y la CASCADA se lleva su receta;
 *   2. reinserta los ítems del payload;
 *   3. reinserta la receta que cada ítem del payload trae en `components`.
 * El paso 3 es el que hoy no existe ni en el SQL ni en el payload.
 */
function rpcReplaceQuotationItems(db: BaseFalsa, quotationId: string, payload: any[]): void {
  if (!Array.isArray(payload)) throw new Error('p_items debe ser un arreglo JSON');
  const sorts = payload.map((p) => Number(p.sort_order));
  if (new Set(sorts).size !== sorts.length) {
    throw new Error('p_items trae sort_order repetidos: la receta no se puede asociar a su ítem');
  }

  const huerfanos = db.items.filter((i) => i.quotation_id === quotationId).map((i) => i.id);
  db.items = db.items.filter((i) => i.quotation_id !== quotationId);
  db.components = db.components.filter((c) => !huerfanos.includes(c.quotation_item_id)); // ON DELETE CASCADE

  for (const elem of payload) {
    const { components, ...fila } = elem;
    const id = `qi-${++seq}`;
    db.items.push({ ...fila, id, quotation_id: quotationId });
    insertarReceta(db, id, Array.isArray(components) ? components : []);
  }
}

function insertarReceta(db: BaseFalsa, itemId: string, comps: any[]): void {
  comps.forEach((c, j) => {
    db.components.push({
      quotation_item_id: itemId,
      sort_order: c.sort_order ?? j,
      category: c.category,
      source_kind: c.source_kind ?? null,
      label: c.label,
      unit: c.unit ?? null,
      quantity: c.quantity,
      unit_cost: c.unit_cost,
      margin_percent: c.margin_percent,
      scope: c.scope,
      is_included: c.is_included,
      id: `qic-${++seq}`,
    });
  });
}

/** Cliente de Supabase de mentira: lo justo que usa `saveQuotationItems`. */
function supabaseFalso(db: BaseFalsa, opciones: { conRpc?: boolean } = {}) {
  const conRpc = opciones.conRpc !== false;
  return {
    rpc(fn: string, args: any) {
      if (!conRpc) return Promise.resolve({ error: { message: 'function does not exist' } });
      if (fn !== 'replace_quotation_items') return Promise.resolve({ error: { message: `función desconocida: ${fn}` } });
      try {
        rpcReplaceQuotationItems(db, args.p_quotation_id, args.p_items);
        return Promise.resolve({ error: null });
      } catch (e: any) {
        return Promise.resolve({ error: { message: e.message } });
      }
    },
    from(tabla: string) {
      const clave: 'items' | 'components' = tabla === 'quotation_items' ? 'items' : 'components';
      let op: 'select' | 'insert' | 'delete' = 'select';
      let filas: Fila[] = [];
      const filtros: Array<[string, any]> = [];
      let orden: string | undefined;
      const q: any = {
        select() { op = 'select'; return q; },
        insert(r: Fila | Fila[]) { op = 'insert'; filas = Array.isArray(r) ? r : [r]; return q; },
        delete() { op = 'delete'; return q; },
        eq(c: string, v: any) { filtros.push([c, v]); return q; },
        in(c: string, vs: any[]) { filtros.push([c, vs]); return q; },
        order(c: string) { orden = c; return q; },
        then(resolve: (r: { data: Fila[] | null; error: any }) => void) {
          const casa = (f: Fila) => filtros.every(([c, v]) => (Array.isArray(v) ? v.includes(f[c]) : f[c] === v));
          if (op === 'delete') {
            const fuera = db[clave].filter(casa);
            if (clave === 'items') {
              const ids = fuera.map((f) => f.id);
              db.components = db.components.filter((c) => !ids.includes(c.quotation_item_id));
            }
            db[clave] = db[clave].filter((f) => !casa(f));
            return resolve({ data: null, error: null });
          }
          if (op === 'insert') {
            for (const f of filas) db[clave].push({ ...f, id: f.id ?? `${clave}-${++seq}` });
            return resolve({ data: null, error: null });
          }
          const data = db[clave].filter(casa);
          if (orden) data.sort((a, b) => Number(a[orden as string]) - Number(b[orden as string]));
          return resolve({ data, error: null });
        },
      };
      return q;
    },
  };
}

/** Lo que hace /api/client/quotations al crear la cotización: ítems + receta. */
function sembrarCotizacion(db: BaseFalsa, quotationId: string, items: any[]): void {
  items.forEach((item, idx) => {
    const id = `qi-${++seq}`;
    db.items.push({ ...toQuotationItemRow(item, idx), id, quotation_id: quotationId });
    insertarReceta(db, id, item._components ?? []);
  });
}

/** Lo que hace el panel al ABRIR: ítems + su receta colgada en `_components`. */
function abrirEnElPanel(db: BaseFalsa, quotationId: string): any[] {
  return db.items
    .filter((i) => i.quotation_id === quotationId)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((i) => ({
      ...i,
      _components: db.components
        .filter((c) => c.quotation_item_id === i.id)
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
        .map((c) => ({
          id: c.id, sort_order: c.sort_order, category: c.category,
          source_kind: c.source_kind ?? null, label: c.label, unit: c.unit ?? null,
          quantity: Number(c.quantity), unit_cost: Number(c.unit_cost),
          margin_percent: Number(c.margin_percent), scope: c.scope, is_included: c.is_included,
        })) as QuotationItemComponent[],
    }));
}

/** El desglose que imprimen PDF, Excel y la pantalla. */
const desglose = (item: any) =>
  buildQuotationItemLines(item).map((l) => [l.label, l.quantity, l.unit_price, l.subtotal]);

const sumaDelDesglose = (item: any) =>
  Math.round(buildQuotationItemLines(item).reduce((s, l) => s + l.subtotal, 0) * 100) / 100;

// ------------------------------------------------------------

describe('SUBC-T3 — el RPC tiene que reescribir la receta que su DELETE se lleva', () => {

  /** La definición vigente: la ÚLTIMA migración que redefine la función. */
  function rpcVigente(): string {
    const dir = join(process.cwd(), 'supabase', 'migrations');
    const archivo = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .reverse()
      .find((f) => /CREATE OR REPLACE FUNCTION\s+(public\.)?replace_quotation_items/i.test(readFileSync(join(dir, f), 'utf8')));
    if (!archivo) throw new Error('no se encontró ninguna migración que defina replace_quotation_items');
    return readFileSync(join(dir, archivo), 'utf8');
  }

  it('la función borra los ítems: si no reinserta la receta, la cascada se la come', () => {
    const sql = rpcVigente();
    expect(sql).toMatch(/DELETE FROM\s+(public\.)?quotation_items/i);
    expect(sql).toMatch(/INSERT INTO\s+(public\.)?quotation_item_components/i);
  });

  it('la reinserción escribe TODOS los campos que definen una receta', () => {
    const sql = rpcVigente();
    const m = sql.match(/INSERT INTO\s+(?:public\.)?quotation_item_components\s*\(([^)]*)\)/i);
    expect(m, 'la función no inserta en quotation_item_components').toBeTruthy();
    const columnas = (m as RegExpMatchArray)[1].split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
    for (const campo of CAMPOS_DE_RECETA) expect(columnas).toContain(campo);
  });
});

describe('SUBC-T3 — abrir y guardar sin cambiar nada', () => {

  function escenario(qty = 1) {
    const db = nuevaBase();
    const nuevo = createQuotationItemFromProduct(EXHIBIDOR, qty, 35, 0);
    sembrarCotizacion(db, 'q-1', [nuevo]);
    return { db, antes: abrirEnElPanel(db, 'q-1') };
  }

  it('la cotización nace con su receta guardada (no es el defecto que se busca)', () => {
    const { db, antes } = escenario();
    expect(db.components).toHaveLength(6);
    expect(antes[0]._components).toHaveLength(6);
    expect(sumaDelDesglose(antes[0])).toBe(195.75);
  });

  // ---- EL DEFECTO ----
  it('guardar sin cambiar nada NO puede borrar la receta', async () => {
    const { db, antes } = escenario();
    await saveQuotationItems(supabaseFalso(db) as any, 'q-1', antes);
    const despues = abrirEnElPanel(db, 'q-1');
    expect(despues[0]._components).toHaveLength(6);
    expect(db.components).toHaveLength(6);
  });

  it('el desglose impreso es el MISMO antes y después de guardar', async () => {
    const { db, antes } = escenario(3);
    const desgloseAntes = desglose(antes[0]);
    await saveQuotationItems(supabaseFalso(db) as any, 'q-1', antes);
    const despues = abrirEnElPanel(db, 'q-1');
    expect(desglose(despues[0])).toEqual(desgloseAntes);
  });

  // ---- EL INVARIANTE QUE FALTABA ----
  it('INVARIANTE: guardar sin modificar no cambia subtotal, total ni filas del desglose', async () => {
    for (const qty of [1, 3, 7]) {
      const { db, antes } = escenario(qty);
      const totalAntes = calcQuotationTotals(antes as any, IGV);
      const filasAntes = buildQuotationItemLines(antes[0]).length;

      await saveQuotationItems(supabaseFalso(db) as any, 'q-1', antes);
      const despues = abrirEnElPanel(db, 'q-1');

      expect(calcQuotationTotals(despues as any, IGV)).toEqual(totalAntes);
      expect(buildQuotationItemLines(despues[0])).toHaveLength(filasAntes);
      expect(sumaDelDesglose(despues[0])).toBe(Number(despues[0].subtotal));
    }
  });

  it('guardar dos veces seguidas tampoco mueve nada (idempotencia de verdad)', async () => {
    const { db, antes } = escenario(2);
    await saveQuotationItems(supabaseFalso(db) as any, 'q-1', antes);
    const unaVez = abrirEnElPanel(db, 'q-1');
    await saveQuotationItems(supabaseFalso(db) as any, 'q-1', unaVez);
    const dosVeces = abrirEnElPanel(db, 'q-1');
    expect(desglose(dosVeces[0])).toEqual(desglose(unaVez[0]));
    expect(dosVeces[0]._components).toHaveLength(6);
  });

  it('el subcomponente destildado sigue destildado después de guardar', async () => {
    const { db, antes } = escenario();
    antes[0]._components = antes[0]._components.map((c: QuotationItemComponent) =>
      c.label === 'Instalacion/entrega' ? { ...c, is_included: false } : c);
    antes[0].subtotal = 162.00;
    await saveQuotationItems(supabaseFalso(db) as any, 'q-1', antes);
    const despues = abrirEnElPanel(db, 'q-1');
    const apagado = despues[0]._components.find((c: QuotationItemComponent) => c.label === 'Instalacion/entrega');
    expect(apagado?.is_included).toBe(false);
    expect(sumaDelDesglose(despues[0])).toBe(162.00);
  });

  it('cada fila persistida trae los campos de la receta, ninguno de menos', async () => {
    const { db, antes } = escenario();
    await saveQuotationItems(supabaseFalso(db) as any, 'q-1', antes);
    expect(db.components.length).toBeGreaterThan(0);
    for (const fila of db.components) {
      for (const campo of CAMPOS_DE_RECETA) expect(Object.keys(fila)).toContain(campo);
    }
  });

  // ---- El respaldo no atómico tampoco puede perder la receta ----
  it('sin el RPC, el respaldo del panel guarda la receta igual', async () => {
    const { db, antes } = escenario();
    await saveQuotationItems(supabaseFalso(db, { conRpc: false }) as any, 'q-1', antes);
    const despues = abrirEnElPanel(db, 'q-1');
    expect(despues[0]._components).toHaveLength(6);
    expect(sumaDelDesglose(despues[0])).toBe(195.75);
  });

  // ---- NO-REGRESIÓN: las viejas no se tocan ----
  it('una cotización SIN receta sobrevive intacta al mismo ciclo (motor legado)', async () => {
    const db = nuevaBase();
    const legado: any = {
      product_name: 'Banner viejo', unit: 'u', quantity: 2, unit_cost: 100, margin_percent: 30,
      material_cost: 100, labor_cost: 20, indirect_cost: 0, unit_price: 130, subtotal: 287,
      has_labor: true, labor_quantity: 1, labor_unit_cost: 20, labor_margin_percent: 30, labor_scope: 'order',
      has_design: false, has_transport: false,
    };
    sembrarCotizacion(db, 'q-vieja', [legado]);
    const antes = abrirEnElPanel(db, 'q-vieja');
    const desgloseAntes = desglose(antes[0]);

    await saveQuotationItems(supabaseFalso(db) as any, 'q-vieja', antes);
    const despues = abrirEnElPanel(db, 'q-vieja');

    expect(despues[0]._components).toHaveLength(0);
    expect(desglose(despues[0])).toEqual(desgloseAntes);
  });
});

describe('SUBC-T3 — duplicar y revisar tampoco pueden nacer sin receta', () => {

  // Duplicar una cotización y crear una revisión CREAN UNA COTIZACIÓN NUEVA:
  // copiaban los ítems con `toQuotationItemRow` —que no sabe de recetas— y se
  // quedaban con el subtotal de la madre. O sea, nacían corrompidas: el mismo
  // defecto de SUBC-T3, pero sin que nadie hubiera abierto y guardado nada.
  const listado = 'src/app/dashboard/cotizaciones/page.tsx';

  /** El cuerpo de una de las dos mutaciones que copian una cotización. */
  function cuerpoDe(mutacion: string): string {
    const fuente = readFileSync(join(process.cwd(), listado), 'utf8');
    const desde = fuente.indexOf(`const ${mutacion} = useMutation(`);
    expect(desde, `no se encontró ${mutacion} en el listado`).toBeGreaterThan(-1);
    const inicio = desde + `const ${mutacion} = useMutation(`.length;
    // El cuerpo termina donde empieza lo siguiente: otra mutación o la primera
    // función suelta del componente.
    const siguienteFuncion = /\n {2}async function /g;
    siguienteFuncion.lastIndex = inicio;
    const cortes = [fuente.indexOf('useMutation(', inicio), siguienteFuncion.exec(fuente)?.index ?? -1]
      .filter((x) => x > 0);
    return fuente.slice(desde, cortes.length ? Math.min(...cortes) : undefined);
  }

  it.each(['duplicateMutation', 'createRevisionMutation'])(
    '%s carga la receta y copia por el camino de guardado probado',
    (mutacion) => {
      const cuerpo = cuerpoDe(mutacion);
      expect(cuerpo).toContain('withComponents');
      expect(cuerpo).toContain('saveQuotationItems');
    },
  );

  it('la copia llega a la cotización nueva con su receta y su desglose', async () => {
    const db = nuevaBase();
    sembrarCotizacion(db, 'q-madre', [createQuotationItemFromProduct(EXHIBIDOR, 2, 35, 0)]);
    const madre = abrirEnElPanel(db, 'q-madre');

    await saveQuotationItems(supabaseFalso(db) as any, 'q-hija', madre);
    const hija = abrirEnElPanel(db, 'q-hija');

    expect(hija[0]._components).toHaveLength(6);
    expect(desglose(hija[0])).toEqual(desglose(madre[0]));
    // La madre no se toca.
    expect(abrirEnElPanel(db, 'q-madre')[0]._components).toHaveLength(6);
  });
});
