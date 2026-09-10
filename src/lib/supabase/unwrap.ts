/**
 * Convierte una respuesta de Supabase en datos o en una excepción.
 *
 * Sin esto, el patrón `(res.data || [])` transforma un fallo en un dato falso:
 * una query de totales que falla no muestra un error, muestra S/ 0.00.
 * En Server Components la excepción sube al error.tsx más cercano.
 */
export function unwrap<T>(
  res: { data: T | null; error: { message: string } | null },
  context: string
): T {
  if (res.error) {
    throw new Error(`[supabase:${context}] ${res.error.message}`);
  }
  if (res.data === null) {
    throw new Error(`[supabase:${context}] respuesta vacía inesperada`);
  }
  return res.data;
}

/** Igual, pero para listados donde "sin filas" es válido. */
export function unwrapList<T>(
  res: { data: T[] | null; error: { message: string } | null },
  context: string
): T[] {
  if (res.error) {
    throw new Error(`[supabase:${context}] ${res.error.message}`);
  }
  return res.data ?? [];
}
