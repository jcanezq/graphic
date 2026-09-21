// ============================================================
// CotiGrafix — La identidad de una fila de receta, y qué filas quiere el cliente
//
// EL PROBLEMA QUE RESUELVE. Cuando el cliente destilda un subcomponente en
// /cotizar, esa fila TODAVÍA NO TIENE `id`: el id nace recién al insertarla en
// `quotation_item_components`, después de guardar. El servidor reconstruye la
// receta del catálogo en cada pedido (§7.12), así que del lado del servidor
// tampoco hay id. Hace falta otra identidad, y tiene que ser la misma de los
// dos lados o el cliente apaga una fila y el servidor apaga otra.
//
// POR QUÉ NO `sort_order`. Porque no identifica: numera. Si alguien agrega un
// material a la receta entre que el cliente carga la página y envía la
// cotización, todas las posiciones de abajo se corren una, y el cliente termina
// excluyendo la fila equivocada — con el agravante de que el total le cerraría
// de casualidad si las dos filas valieran parecido. Un identificador que cambia
// cuando el vecino se mueve no es un identificador.
//
// LA CLAVE ELEGIDA: `categoría:source_kind:etiqueta`, normalizada.
//   - Es DETERMINÍSTICA POR CONTENIDO: la calculan por separado el catálogo
//     público y el servidor, sobre los mismos datos, y dan lo mismo.
//   - Es ESTABLE frente a lo que de verdad cambia seguido: agregar, quitar o
//     reordenar OTRAS filas, y cambiar el precio o la cantidad de la propia.
//     Ni el costo ni la cantidad entran en la clave, a propósito: subir el
//     precio del canto no lo convierte en otro canto. Que el precio cambió se
//     detecta comparando plata, que es donde se ve.
//   - Es LEGIBLE: `material::cantos / tapacantos`, `production:design:diseño
//     gráfico`. Se puede leer en un log sin descifrarla.
//
// QUÉ PASA SI DOS FILAS COLISIONAN (la pregunta incómoda). Una receta puede
// tener dos materiales con el mismo nombre —dos «Vinil» de proveedores
// distintos—. Entonces la clave base se repite, y a la segunda aparición se le
// agrega `#2`, a la tercera `#3`. O sea: el desempate es POSICIONAL, pero SÓLO
// entre las filas que colisionan; las demás conservan su clave pase lo que
// pase. Es una degradación acotada y declarada, no un accidente:
//
//   · Si entre la carga y el envío se agrega o se borra UNA DE LAS HOMÓNIMAS,
//     los sufijos se corren entre ellas y el cliente puede terminar excluyendo
//     la otra «Vinil». Cuánto se cobra cambia -> el total deja de coincidir con
//     el que aceptó -> SALE EL AVISO. Nunca se le cobra callado otro número.
//   · Si colisionan dos filas de precio idéntico, da igual cuál se apague: el
//     dinero es el mismo y no hay nada que avisar.
//
// La alternativa —tratar la clave como grupo y apagar todas las homónimas—
// se descartó: destildar un «Vinil» apagaría los dos, y el cliente pagaría
// menos de lo que aceptó sin haberlo pedido.
//
// LO QUE ESTE ARCHIVO NO HACE, Y NO PUEDE HACER (§7.12). No lee un solo precio
// del cliente. La selección que entra acá dice QUÉ FILAS quiere, jamás cuánto
// valen: el costo, el margen y la cantidad salen del catálogo, en el servidor.
// El total que el cliente aceptó viaja aparte y SÓLO se compara — si algún día
// ese número entra en una multiplicación, se acabó la regla.
// ============================================================

import { round2, type QuotationItemComponent } from '@/lib/pricing';
import { repriceItemFromComponents } from '@/lib/calculations';
import type { QuotationItem } from '@/types';

/** Lo mínimo que hace falta para identificar una fila de receta. */
export interface ComponentIdentity {
  category: string;
  source_kind?: string | null;
  label: string;
}

/** Lo que el cliente manda por cada fila: cuál es y si la quiere. Nada más. */
export interface ClientComponentChoice {
  key: string;
  included: boolean;
}

/** Lo que cambió en UNA línea de la cotización respecto de lo que el cliente vio. */
export interface CatalogChange {
  /** Nombre del producto, para que el aviso se pueda leer. */
  item: string;
  /** Etiquetas de filas COBRABLES que el cliente nunca vio y que igual se cobran. */
  added: string[];
  /** Claves que el cliente mandó y que el catálogo vigente ya no tiene. */
  missing: string[];
}

/** El aviso que viaja en la respuesta cuando el resultado difiere de lo aceptado. */
export interface PriceNotice {
  /** El total que el cliente dijo haber aceptado. `null` si no lo mandó. */
  accepted_total: number | null;
  /** El total real, calculado del catálogo. Es el que se guardó. */
  total: number;
  /** `total - accepted_total`. `null` si no hay con qué comparar. */
  difference: number | null;
  changes: CatalogChange[];
}

/** Normaliza la etiqueta: espacios de sobra y mayúsculas no hacen otra fila. */
function normalizeLabel(label: unknown): string {
  return String(label ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * La clave BASE de una fila: sin el desempate de colisión.
 * Usar `buildComponentRowKeys` para una receta entera — es la que desempata.
 */
export function componentRowKey(row: ComponentIdentity): string {
  return `${row.category}:${row.source_kind ?? ''}:${normalizeLabel(row.label)}`;
}

/**
 * Las claves de una receta COMPLETA, en su orden, con las colisiones
 * desempatadas por aparición (`#2`, `#3`, ...).
 *
 * ⚠ SE CALCULA SOBRE LA RECETA ENTERA, incluidas las filas que no se cobran
 * (costo cero). El catálogo público no publica esas filas, pero SÍ las cuenta
 * acá antes de descartarlas: si no, una fila gratis con nombre repetido correría
 * los sufijos de un lado y no del otro, y el cliente apagaría la fila de al
 * lado. Ver `buildPublicComponents`.
 */
export function buildComponentRowKeys(rows: ComponentIdentity[]): string[] {
  const vistas = new Map<string, number>();
  return rows.map((row) => {
    const base = componentRowKey(row);
    const n = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}

/**
 * Traduce los subcomponentes del carrito a la selección que viaja por la red.
 *
 * Manda la lista COMPLETA de filas que el cliente vio, no sólo las incluidas,
 * y es deliberado: sin la lista completa el servidor no puede distinguir «esta
 * fila la destildó» de «esta fila apareció después y él nunca la vio», que es
 * justo la diferencia entre no cobrarla y cobrarla avisando.
 *
 * `key` llega publicada por `/api/public/products`; un borrador guardado en el
 * navegador ANTES de este arreglo no la trae, y entonces se recalcula acá con
 * la misma función. Un borrador viejo puede haber perdido las filas de costo
 * cero, así que su recálculo es el mejor esfuerzo: si desempata distinto, lo
 * que cambia es la plata, y eso levanta el aviso. Nunca se cobra en silencio.
 */
export function toClientComponentSelection(
  components: Array<Partial<ComponentIdentity> & { key?: string; is_included?: boolean }>,
): ClientComponentChoice[] {
  const recalculadas = buildComponentRowKeys(
    components.map((c) => ({
      category: String(c.category ?? ''),
      source_kind: c.source_kind ?? null,
      label: String(c.label ?? ''),
    })),
  );
  return components.map((c, i) => ({
    key: c.key ?? recalculadas[i],
    included: c.is_included !== false,
  }));
}

/**
 * Aplica al ítem reconstruido la selección del cliente y lo vuelve a valorizar.
 *
 * LA DECISIÓN DEL DUEÑO, escrita en una línea de código: una fila que el cliente
 * NUNCA VIO **se cobra** (`included` por omisión) y **se reporta** en `added`.
 * Cobrarla callado quedó descartado expresamente; regalarla tampoco es opción,
 * porque el precio real es el del catálogo vigente. Se cobra y se avisa.
 *
 * `selection` nula o ausente = cliente que no mandó nada (una pestaña vieja):
 * el ítem sale intacto, exactamente como antes de este arreglo.
 *
 * @returns el ítem revalorizado, las etiquetas de lo que se agregó y las claves
 *          que el cliente mandó y ya no existen.
 */
export function applyClientComponentSelection<
  T extends QuotationItem & { _components?: QuotationItemComponent[] },
>(
  item: T,
  selection: ClientComponentChoice[] | null | undefined,
): { item: T; added: string[]; missing: string[] } {
  const componentes = item._components ?? [];
  if (!selection || componentes.length === 0) {
    return { item, added: [], missing: [] };
  }

  const claves = buildComponentRowKeys(componentes);
  const pedido = new Map<string, boolean>();
  for (const s of selection) pedido.set(s.key, s.included);

  const filtrados = componentes.map((c, i) => ({
    ...c,
    // Lo que el cliente vio manda; lo que no vio se cobra y se avisa.
    is_included: pedido.has(claves[i]) ? pedido.get(claves[i])! : true,
  }));

  // Una fila que no cobra —costo cero— no se anuncia como novedad: el catálogo
  // público nunca la publicó, así que el cliente «no la vio» siempre, y avisar
  // de algo que no mueve un centavo sólo entrena a ignorar el cartel.
  const added = componentes
    .map((c, i) => ({ c, key: claves[i] }))
    .filter(({ c, key }) => !pedido.has(key) && Number(c.unit_cost) > 0)
    .map(({ c }) => c.label);

  const presentes = new Set(claves);
  const missing = selection.map((s) => s.key).filter((k) => !presentes.has(k));

  return {
    item: repriceItemFromComponents({ ...item, _components: filtrados }),
    added,
    missing,
  };
}

/**
 * Arma el aviso, o devuelve `null` cuando no hay nada que avisar.
 *
 * CUÁNDO SALE. Cuando la plata difiere de la que el cliente aceptó, o cuando se
 * le está cobrando una fila que nunca vio. Esos son los dos casos en los que
 * callarse sería cobrarle un monto distinto del aceptado.
 *
 * CUÁNDO NO SALE, y por qué. Una fila que el cliente DESTILDÓ y que además
 * desapareció del catálogo no cambia lo que paga —estaba apagada— así que por
 * sí sola no levanta el cartel; se lista igual dentro del aviso cuando el
 * cartel sale por otro motivo, porque ahí sí ayuda a explicarlo. Un cartel que
 * aparece siempre es un cartel que nadie lee, y lo que se está protegiendo es
 * justamente que cuando aparezca, se lea.
 *
 * ⚠ `acceptedTotal` NO participa del precio. Entra, se compara y se repite en
 * la respuesta. Si alguna vez aparece en una suma o en un producto, la regla
 * §7.12 dejó de valer y el cliente puede fijar su propio total.
 */
export function buildPriceNotice(
  acceptedTotal: number | null | undefined,
  total: number,
  changes: CatalogChange[],
): PriceNotice | null {
  const aceptado = acceptedTotal == null ? null : round2(Number(acceptedTotal));
  const real = round2(Number(total));

  const cambiaLaPlata = aceptado !== null && aceptado !== real;
  const seCobraAlgoNoVisto = changes.some((c) => c.added.length > 0);
  if (!cambiaLaPlata && !seCobraAlgoNoVisto) return null;

  return {
    accepted_total: aceptado,
    total: real,
    difference: aceptado === null ? null : round2(real - aceptado),
    changes: changes.filter((c) => c.added.length > 0 || c.missing.length > 0),
  };
}
