# Seeds

Scripts de poblado. **No son migraciones**: el CLI no los aplica en `db push`.

- `seed_products.sql` — ⚠️ DESTRUCTIVO. Reemplaza las listas de materiales de 10 productos.
  Sólo para bases nuevas. Ver el encabezado del archivo.

Para un seed reproducible en desarrollo local, el CLI ejecuta `supabase/seed.sql`
automáticamente en `supabase db reset` (nunca contra la nube).
