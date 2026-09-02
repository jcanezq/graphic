# Tareas de Implementación

## Fase 1: Experiencia de Usuario (UX/UI) y Rendimiento
- `[x]` Implementar paginación desde el servidor en `ProductsPage`
- `[x]` Implementar paginación desde el servidor en `MaterialsPage`
- `[x]` Implementar actualizaciones optimistas (Optimistic Updates) en Productos y Materiales
- `[x]` Mejorar diseño de Skeletons

## Fase 2: Arquitectura y Código Frontend
- `[x]` Instalar dependencias (`react-hook-form`, `zod`, `@hookform/resolvers`)
- `[x]` Crear esquemas de Zod para validación
- `[x]` Separar `ProductForm` en sub-componentes (BasicInfoTab, MaterialsTab, LaborTab, IndirectCostsTab, CostSummary)
- `[x]` Integrar `react-hook-form` en la página de Productos `[id]`

## Fase 3: Base de Datos y Supabase (Schema)
- `[x]` Actualizar `schema.sql` agregando `deleted_at` a `products`, `materials`, `clients`, `quotations`, `categories`
- `[x]` Modificar eliminación de Productos a usar Soft Delete en vez de `.delete()`
- `[x]` Modificar eliminación de Materiales a usar Soft Delete
- `[x]` Modificar consultas de lectura (Selects) para excluir `deleted_at IS NOT NULL`
