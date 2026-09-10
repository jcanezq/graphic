# Archivos históricos — NO son la fuente de verdad

Estos scripts se ejecutaban a mano en el SQL Editor del Dashboard. Se conservan por trazabilidad.

- `schema.sql` — último cambio: commit 592923a. Le faltaban 19 columnas, el CHECK de 'solicitada'
  y 5 políticas respecto de producción.
- `clients_table.sql` — una de las TRES definiciones divergentes de `clients` (ver F3-T4).
- `rpc_quotation_number.sql` — versión previa de `generate_quotation_number()`.

**No ejecutar ninguno.** El esquema vigente es `supabase/migrations/00000000000000_baseline.sql`
más las migraciones posteriores. Para cambiar el esquema: `supabase migration new <nombre>`.
