// ============================================================
// CotiGrafix — Guardado de los ítems de una cotización desde el panel
//
// Vivía dentro del componente de React (dashboard/cotizaciones/[id]/page.tsx),
// donde ninguna prueba podía llegar: el ciclo abrir -> guardar es justamente el
// que rompía la receta y no había forma de fijarlo. Acá es una función con una
// dependencia declarada (el cliente de Supabase), así que se puede ejercitar
// contra una base en memoria.
//
// ┌──────────────────────────────────────────────────────────┐
// │  LOS ÍTEMS Y SU RECETA SE ESCRIBEN JUNTOS O NO SE         │
// │  ESCRIBEN.                                               │
// │  `quotation_item_components` cuelga del ítem ON DELETE    │
// │  CASCADE. El RPC borra los ítems para reinsertarlos, así  │
// │  que la receta se va con ellos SIEMPRE: la única pregunta │
// │  es si vuelve en la misma transacción. Por eso la receta  │
// │  viaja DENTRO del payload (`components`) y no en una      │
// │  segunda llamada: entre una llamada y otra habría una     │
// │  ventana con ítems sin receta, y en esa ventana el ítem   │
// │  cae al motor legado y cobra lo que no corresponde.       │
// └──────────────────────────────────────────────────────────┘
// ============================================================

import type { QuotationItem } from '@/types';
import type { QuotationItemComponent } from '@/lib/pricing';
import { toReplaceItemsPayload, toQuotationItemComponentRows } from '@/lib/quotation-item-row';

/** Lo poco que esta función le pide al cliente de Supabase. */
export interface SupabaseLike {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
  from(table: string): any;
}

type ItemConReceta = QuotationItem & { _components?: QuotationItemComponent[] };

/**
 * Reemplaza los ítems de una cotización y su receta.
 *
 * Camino normal: el RPC `replace_quotation_items`, que hace el borrado y las
 * dos reinserciones DENTRO de una transacción. El respaldo de abajo existe sólo
 * para una base donde la migración todavía no se aplicó: hace lo mismo en
 * varios viajes y por eso NO es atómico — está documentado en su comentario.
 */
export async function saveQuotationItems(
  supabase: SupabaseLike,
  quotationId: string,
  items: ItemConReceta[],
): Promise<void> {
  const itemsPayload = toReplaceItemsPayload(items);

  const { error: rpcError } = await supabase.rpc('replace_quotation_items', {
    p_quotation_id: quotationId,
    p_items: itemsPayload,
  });

  if (!rpcError) return;

  console.warn('RPC replace_quotation_items not available, using fallback:', rpcError);
  await saveQuotationItemsSinRpc(supabase, quotationId, items);
}

/**
 * Respaldo para una base sin la migración del RPC. NO es atómico: entre el
 * borrado y la reinserción de la receta hay una ventana real. Se conserva
 * porque perder el guardado entero sería peor, pero escribe la receta igual: si
 * no lo hiciera, cada guardado desde una base atrasada dejaría la cotización
 * muda para el desglose.
 */
async function saveQuotationItemsSinRpc(
  supabase: SupabaseLike,
  quotationId: string,
  items: ItemConReceta[],
): Promise<void> {
  const itemsPayload = toReplaceItemsPayload(items);

  const { error: deleteError } = await supabase
    .from('quotation_items')
    .delete()
    .eq('quotation_id', quotationId);

  if (deleteError) {
    throw new Error('Error al actualizar ítems: ' + deleteError.message);
  }

  if (itemsPayload.length === 0) return;

  // `components` no es una columna de `quotation_items`: se saca de la fila.
  const { error: insertError } = await supabase.from('quotation_items').insert(
    itemsPayload.map(({ components, ...row }) => ({ ...row, quotation_id: quotationId })),
  );

  if (insertError) {
    throw new Error('Error crítico: los ítems no se pudieron guardar. Revisa la cotización.');
  }

  if (!items.some((it) => (it._components?.length ?? 0) > 0)) return;

  // Los ids reales de los ítems recién insertados son necesarios para la FK.
  const { data: insertados } = await supabase
    .from('quotation_items')
    .select('id, sort_order')
    .eq('quotation_id', quotationId)
    .order('sort_order');

  const filas = (items as ItemConReceta[]).flatMap((item, idx) => {
    const id = (insertados ?? [])[idx]?.id;
    return id ? toQuotationItemComponentRows(item, id) : [];
  });

  if (filas.length === 0) return;

  const { error: compError } = await supabase.from('quotation_item_components').insert(filas);

  if (compError) {
    throw new Error(
      'Los ítems se guardaron pero su desglose no. Volvé a guardar la cotización antes de exportarla.',
    );
  }
}
