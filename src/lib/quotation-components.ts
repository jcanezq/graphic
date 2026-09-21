// ============================================================
// CotiGrafix — Cargar la receta de los ítems ya guardados
//
// `buildQuotationItemLines` decide el desglose mirando `_components`: si el
// ítem trae receta, imprime la receta; si no, cae al motor legado. O sea que
// QUIEN NO CARGA LA RECETA IMPRIME OTRA COSA, sin error y sin aviso. Y la
// diferencia no es cosmética: el interruptor `is_included` vive en la receta,
// así que un subcomponente destildado, leído sin ella, vuelve a cobrarse.
//
// Por eso la carga está acá y no copiada en cada lector. Cada pantalla y cada
// documento que arme un desglose tiene que pasar por esta función.
// ============================================================

import type { QuotationItemComponent } from '@/lib/pricing';

/** Una fila de `quotation_item_components` tal como la devuelve la base. */
export function mapComponentRow(row: any): QuotationItemComponent {
  return {
    id: row.id,
    sort_order: Number(row.sort_order) || 0,
    category: row.category,
    source_kind: row.source_kind ?? null,
    label: row.label,
    unit: row.unit ?? null,
    quantity: Number(row.quantity),
    unit_cost: Number(row.unit_cost),
    margin_percent: Number(row.margin_percent),
    scope: row.scope,
    is_included: row.is_included,
  };
}

/** Cuelga de cada ítem su receta, ordenada. Un ítem sin receta queda con []. */
export function attachComponents<T extends { id?: string | null }>(
  items: T[],
  rows: any[] | null | undefined,
): Array<T & { _components: QuotationItemComponent[] }> {
  const porItem = new Map<string, QuotationItemComponent[]>();
  for (const row of rows ?? []) {
    const clave = String(row.quotation_item_id);
    const lista = porItem.get(clave) ?? [];
    lista.push(mapComponentRow(row));
    porItem.set(clave, lista);
  }
  porItem.forEach((lista) => lista.sort((a, b) => a.sort_order - b.sort_order));

  return items.map((item) => ({ ...item, _components: porItem.get(String(item.id)) ?? [] }));
}

/**
 * Lee la receta de una lista de ítems y se la cuelga.
 *
 * Si la consulta falla —por ejemplo una base donde la migración de
 * `quotation_item_components` todavía no se aplicó— devuelve los ítems con la
 * receta vacía: el desglose sale por el motor legado, que es exactamente lo que
 * esas cotizaciones tenían antes. No se rompe nada por no tener receta.
 */
export async function withComponents<T extends { id?: string | null }>(
  supabase: { from(table: string): any },
  items: T[] | null | undefined,
): Promise<Array<T & { _components: QuotationItemComponent[] }>> {
  const lista = items ?? [];
  const ids = lista.map((i) => i.id).filter(Boolean);
  if (ids.length === 0) return attachComponents(lista, []);

  const { data } = await supabase
    .from('quotation_item_components')
    .select('*')
    .in('quotation_item_id', ids);

  return attachComponents(lista, data);
}
