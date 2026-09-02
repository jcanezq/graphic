# Plan de Implementación de Mejoras

Este plan detalla los pasos para implementar las mejoras sugeridas, respetando el orden de prioridad solicitado.

## User Review Required

> [!WARNING]  
> **Soft Deletes vs. Políticas Globales:** Al implementar "Soft Deletes" (marcar como borrado en lugar de eliminar físicamente), las consultas actuales (ej. `select("*")`) traerán también los borrados a menos que se filtren explícitamente (`.is('deleted_at', null)`). Modificaré las llamadas al backend en la aplicación para aplicar este filtro siempre. ¿Estás de acuerdo con este enfoque?

## Open Questions

- ¿Tienes alguna preferencia de diseño para los Skeletons (animaciones de carga)? Por defecto usaré una estructura de "filas y columnas" más parecida a la tabla final para evitar el "salto visual" cuando cargan los datos.

## Proposed Changes

### Fase 1: Experiencia de Usuario (UX/UI) y Rendimiento

Mejoraremos la forma en la que la aplicación responde a las acciones del usuario y maneja la carga de datos masivos.

#### [MODIFY] `src/app/dashboard/productos/page.tsx` y `src/app/dashboard/materiales/page.tsx`
- Implementar **paginación desde el servidor (Server-Side Pagination)** utilizando `range()` de Supabase en lugar de paginar los datos en el cliente.
- Implementar **Actualizaciones Optimistas (Optimistic Updates)** usando la caché de React Query. Esto hará que al eliminar, duplicar o guardar, la tabla cambie instantáneamente sin esperar a que el servidor termine de procesar.
- Mejorar el diseño visual de los `skeletons` para que simulen la tabla real.

### Fase 2: Arquitectura y Código Frontend

Refactorización de formularios masivos para usar librerías de grado empresarial que garanticen el rendimiento y validación.

#### [NEW] `package.json` (Dependencias)
- Instalar `react-hook-form`, `zod` y `@hookform/resolvers`.

#### [MODIFY] `src/app/dashboard/productos/[id]/page.tsx`
- Refactorizar el formulario de +600 líneas reemplazando los múltiples `useState` por un manejador central de `react-hook-form`.
- Utilizar esquemas de validación Zod para evitar que el usuario guarde sin datos clave.

#### [NEW] `src/components/products/`
- Mover las lógicas a sub-componentes: `BasicInfoTab.tsx`, `MaterialsTab.tsx`, `LaborTab.tsx`, `IndirectCostsTab.tsx`, `CostSummary.tsx` para mejorar la mantenibilidad del código.

### Fase 3: Base de Datos y Supabase (Schema)

Proteger la integridad referencial y de auditoría implementando "Soft Deletes".

#### [MODIFY] `supabase/schema.sql`
- Agregar la columna `deleted_at TIMESTAMPTZ` a las tablas `products`, `materials`, `clients`, `quotations`.

#### [MODIFY] Múltiples Archivos Frontend
- Actualizar las mutaciones de eliminación en React Query para que usen `update({ deleted_at: new Date().toISOString() })` en lugar de `.delete()`.
- Modificar las consultas de `select()` en toda la aplicación para agregar el filtro `.is('deleted_at', null)`.

---

## Verification Plan

### Manual Verification
1. **Fase 1:** Navegar por Productos y Materiales. Comprobar que la paginación carga rápidamente desde el backend y que eliminar un ítem lo desaparece de la UI instantáneamente.
2. **Fase 2:** Editar y crear un producto nuevo comprobando que las validaciones impiden errores y que el rendimiento al escribir no causa ralentización en la interfaz.
3. **Fase 3:** "Eliminar" un material y verificar en la base de datos (vía Supabase) que la fila aún existe pero tiene una fecha en la columna `deleted_at`, y que el material ya no aparece en el sistema.
