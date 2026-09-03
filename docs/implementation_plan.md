# Refactorización de Costos de Materiales (Live Pricing)

## Goal Description
El objetivo es resolver el problema de los costos "congelados" en las recetas de los productos. Actualmente, cuando un material es asignado a un producto, su costo se copia a la tabla `product_materials` y el producto usa esa copia estática para calcular su costo. Si el precio del material maestro cambia, el producto no se entera.

Modificaremos las consultas en toda la aplicación para que, al cargar los materiales de un producto (`product_materials`), el sistema haga un `JOIN` con la tabla `materials` y sobreescriba el costo, nombre y unidad al vuelo. De esta manera:
- Los productos siempre mostrarán y usarán el **costo actualizado** del material.
- Las cotizaciones nuevas usarán el costo actualizado.
- Las cotizaciones **antiguas y guardadas** no se verán afectadas, ya que `quotation_items` seguirá guardando su propio snapshot independiente (lo cual es el comportamiento correcto e ideal para auditoría de precios).

## Proposed Changes

### 1. Tipos (TypeScript)
- **MODIFY** [`src/types/index.ts`](file:///d:/proyectos/galeria/cotigrafic/src/types/index.ts)
  - Actualizar `ProductMaterial` para incluir la relación opcional `materials?: { cost: number, name: string, unit: string } | null;`.

### 2. Listados de Productos y Servicios
- **MODIFY** [`src/app/dashboard/productos/page.tsx`](file:///d:/proyectos/galeria/cotigrafic/src/app/dashboard/productos/page.tsx)
  - Actualizar la consulta: `supabase.from("product_materials").select("*, materials(id, cost, name, unit)")`.
  - Mapear la respuesta para que `unit_cost` herede `m.materials.cost` si existe.
- **MODIFY** [`src/app/dashboard/servicios/page.tsx`](file:///d:/proyectos/galeria/cotigrafic/src/app/dashboard/servicios/page.tsx)
  - Aplicar exactamente la misma actualización de consulta y mapeo.

### 3. Formularios de Edición/Creación
- **MODIFY** [`src/app/dashboard/productos/[id]/page.tsx`](file:///d:/proyectos/galeria/cotigrafic/src/app/dashboard/productos/[id]/page.tsx)
  - Actualizar la consulta: `supabase.from("product_materials").select("*, materials(id, cost, name, unit)")`.
  - Mapear para que al abrir el formulario de edición, los campos se pre-carguen con los costos actualizados del material maestro.
- **MODIFY** [`src/app/dashboard/servicios/[id]/page.tsx`](file:///d:/proyectos/galeria/cotigrafic/src/app/dashboard/servicios/[id]/page.tsx)
  - Aplicar la misma actualización.

### 4. Cotizador
- **MODIFY** [`src/app/dashboard/cotizaciones/nueva/page.tsx`](file:///d:/proyectos/galeria/cotigrafic/src/app/dashboard/cotizaciones/nueva/page.tsx)
  - Actualizar la consulta: `supabase.from("product_materials").select("*, materials(id, cost, name, unit)")`.
  - Mapear de igual forma para asegurar que cuando el usuario agregue un producto a una nueva cotización, arrastre el precio en vivo y no el histórico.

## Verification Plan
1. Crear o identificar un Material (ej: "Acrílico") con un costo X (ej: S/ 10).
2. Crear un Producto y agregarle el "Acrílico". El costo del producto reflejará S/ 10.
3. Ir al listado de materiales y editar el costo de "Acrílico" a S/ 20.
4. Entrar al listado de productos/servicios y verificar que el costo unitario recalculado ahora refleje S/ 20 de forma automática sin tener que editar el producto.
5. Entrar a crear una Nueva Cotización y agregar el producto para verificar que arrastra el costo actualizado.
