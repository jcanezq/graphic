// ============================================================
// CotiGrafix — Guardado de los ítems de una cotización desde el panel
//
// Vivía dentro del componente de React (dashboard/cotizaciones/[id]/page.tsx),
// donde ninguna prueba podía llegar: el ciclo abrir -> guardar es justamente el
// que rompía la receta y no había forma de fijarlo. Acá es una función con una
// dependencia declarada (el cliente de Supabase), así que se puede ejercitar
// contra una base en memoria.
//
// NO cambia de comportamiento respecto de lo que hacía el componente.
// ============================================================

import type { QuotationItem } from '@/types';
import { toQuotationItemRow } from '@/lib/quotation-item-row';

/** Lo poco que esta función le pide al cliente de Supabase. */
export interface SupabaseLike {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
  from(table: string): any;
}

/**
 * Reemplaza los ítems de una cotización.
 *
 * Camino normal: el RPC `replace_quotation_items`, que hace el borrado y la
 * reinserción DENTRO de una transacción. El respaldo de abajo existe sólo para
 * una base donde la migración todavía no se aplicó: hace lo mismo en dos viajes
 * y por eso NO es atómico.
 */
export async function saveQuotationItems(
  supabase: SupabaseLike,
  quotationId: string,
  items: QuotationItem[],
): Promise<void> {
  const itemsPayload = items.map((item, idx) => toQuotationItemRow(item, idx));

  const { error: rpcError } = await supabase.rpc('replace_quotation_items', {
    p_quotation_id: quotationId,
    p_items: itemsPayload,
  });

  if (!rpcError) return;

  console.warn('RPC replace_quotation_items not available, using fallback:', rpcError);

  const { error: deleteError } = await supabase
    .from('quotation_items')
    .delete()
    .eq('quotation_id', quotationId);

  if (deleteError) {
    throw new Error('Error al actualizar ítems: ' + deleteError.message);
  }

  if (itemsPayload.length === 0) return;

  const { error: insertError } = await supabase.from('quotation_items').insert(
    itemsPayload.map((row) => ({ ...row, quotation_id: quotationId })),
  );

  if (insertError) {
    throw new Error('Error crítico: los ítems no se pudieron guardar. Revisa la cotización.');
  }
}
