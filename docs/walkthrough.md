# Resumen de Refactorización: Precios en Vivo (Live Pricing)

He completado exitosamente la refactorización arquitectónica de la base de datos y consultas para asegurar que los costos de los productos y servicios usen siempre el **precio actualizado** del catálogo de materiales.

## ¿Qué cambió internamente?

1. **Tipado**: Se actualizó la interfaz de TypeScript `ProductMaterial` para soportar la relación embebida con el maestro de `materials`.
2. **Consultas con JOIN**: En todas las vistas principales (`/productos`, `/servicios`) y en el cotizador (`/cotizaciones/nueva`), la consulta a Supabase ahora hace un `JOIN` para extraer el precio maestro:
   `supabase.from("product_materials").select("*, materials(id, cost, name, unit)")`
3. **Mapeo en Tiempo Real**: Al recibir la respuesta de la base de datos, el sistema inyecta el `materials.cost` sobre el `unit_cost` guardado en la receta.
   - Si el material maestro existe, su precio manda.
   - Si es un insumo customizado sin maestro (`material_id = null`), respeta el precio ingresado manualmente.

## Verificación

- `npm run build` ejecutado exitosamente sin errores de compilación de Next.js ni quejas de TypeScript.
- Toda la lógica del motor de cálculos de precios se mantuvo intacta y transparente, ya que la refactorización se hizo a nivel de la capa de datos.

> [!TIP]
> **No necesitas hacer nada más.** Desde este momento, cualquier cambio que hagas en el costo de la pestaña **Materiales** actualizará automáticamente el costo de todos los productos y servicios que usen dicho material, y al crear nuevas cotizaciones se usará el precio nuevo. Las cotizaciones que ya estaban guardadas mantendrán su precio histórico intacto.
