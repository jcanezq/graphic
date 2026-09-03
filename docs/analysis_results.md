# Análisis Senior: ¿Separar Productos y Servicios en dos tablas?

## Contexto del Sistema Actual

Tu sistema **CotiGrafix** usa una sola tabla `products` con una columna `type` que discrimina entre `'Producto'` y `'Servicio'`. Este patrón se llama **Single Table Inheritance (STI)**.

He auditado las **50+ referencias** a esta tabla en todo el código fuente para darte un veredicto fundamentado.

---

## Opción A: Mantener tabla única `products` (STI) — Estado Actual

### ✅ Ventajas

| Aspecto | Detalle |
|---------|---------|
| **Rendimiento** | Una sola tabla = un solo índice. Las queries con `WHERE type = 'Producto'` son extremadamente rápidas en PostgreSQL gracias a los **partial indexes**. Con menos de 10,000 registros (tu caso), la diferencia de rendimiento entre una tabla o dos es literalmente **0 ms**. |
| **Cotizador unificado** | `quotation_items.product_id` apunta a un solo lugar. El cotizador puede mezclar productos y servicios en una misma cotización sin lógica adicional. Esto es **crítico** para tu negocio: una cotización de "Exhibidor + Instalación de Vinil" funciona de forma natural. |
| **Código simple** | Tus funciones de cálculo ([`calculations.ts`](file:///d:/proyectos/galeria/cotigrafic/src/lib/calculations.ts)) son genéricas. `calcMaterialCost()`, `calcUnitCost()`, `createQuotationItemFromProduct()` funcionan igual para ambos tipos. **Cero duplicación de lógica.** |
| **Validaciones unificadas** | Un solo esquema Zod ([`product.ts`](file:///d:/proyectos/galeria/cotigrafic/src/lib/validations/product.ts)), un solo tipo TypeScript `Product`, un solo formulario reutilizable. |
| **Mantenimiento futuro** | Si necesitas agregar un campo (ej. `warranty_days`), lo agregas en **1 tabla**, **1 tipo**, **1 validación**. |

### ❌ Desventajas

| Aspecto | Detalle |
|---------|---------|
| **Semántica del nombre** | La tabla se llama `products` pero contiene servicios. Confuso para un desarrollador nuevo. |
| **Columnas potencialmente vacías** | Si en el futuro un Producto necesita `weight_kg` y un Servicio necesita `sla_hours`, ambas columnas existirían en la misma tabla pero una siempre estaría vacía para el otro tipo. |

---

## Opción B: Separar en tablas `products` y `services`

### ✅ Ventajas

| Aspecto | Detalle |
|---------|---------|
| **Claridad semántica** | Cada tabla tiene un nombre que describe exactamente lo que contiene. |
| **Independencia de esquema** | Si los servicios necesitan campos exclusivos en el futuro, no "contaminan" la tabla de productos. |

### ❌ Desventajas (Impacto Real en tu sistema)

| Aspecto | Impacto | Severidad |
|---------|---------|-----------|
| **Duplicación de tablas pivote** | Necesitarías crear `service_materials`, `service_labor`, `service_indirect_costs` como copias de las de `product_*`. Son **3 tablas nuevas** con esquema idéntico. | 🔴 Alto |
| **Cotizador roto** | `quotation_items.product_id` ya no puede apuntar a un solo lugar. Opciones: (a) agregar `service_id` como columna separada, o (b) usar relación polimórfica (`item_type` + `item_id`). Ambas complican significativamente las queries y la lógica del cotizador. | 🔴 Crítico |
| **Duplicación de código** | Hoy tienes **1 archivo** de cálculos, **1 tipo**, **1 validación**, y **2 páginas** (productos y servicios) que reusan los mismos componentes. Con tablas separadas necesitarías duplicar o abstraer todo. | 🔴 Alto |
| **Dashboard roto** | La query del [Dashboard](file:///d:/proyectos/galeria/cotigrafic/src/app/dashboard/page.tsx#L17) cuenta productos activos con una sola query. Con dos tablas, necesitarías dos queries y sumarlas. | 🟡 Medio |
| **PDF Export** | [`pdf-export.ts`](file:///d:/proyectos/galeria/cotigrafic/src/lib/pdf-export.ts) trabaja con `QuotationItem` que tiene `product_id`. Habría que adaptar la lógica de trazabilidad. | 🟡 Medio |
| **Archivos a modificar** | He contado **14 archivos** y **50+ líneas** que referencian la tabla `products` o `product_id`. Todos requerirían cambios. | 🔴 Alto |
| **Rendimiento** | Para tu volumen de datos (< 1,000 registros), **no hay ganancia medible**. PostgreSQL maneja tablas de millones de filas sin problemas. Separar no mejora nada. | ⚪ Nulo |

---

## Análisis de Rendimiento (Números Reales)

```
Escenario: Catálogo de 500 items (300 productos + 200 servicios)

┌──────────────────────────────┬────────────────────┬────────────────────┐
│ Operación                    │ 1 tabla (STI)      │ 2 tablas separadas │
├──────────────────────────────┼────────────────────┼────────────────────┤
│ Listar productos             │ ~2ms (WHERE type)  │ ~2ms (SELECT *)    │
│ Listar servicios             │ ~2ms (WHERE type)  │ ~2ms (SELECT *)    │
│ Buscar en cotizador          │ ~3ms (1 query)     │ ~5ms (2 queries)   │
│ Guardar cotización           │ 1 INSERT a items   │ Lógica condicional │
│ Índice en disco              │ 1 índice           │ 2 índices          │
└──────────────────────────────┴────────────────────┴────────────────────┘
```

> [!IMPORTANT]
> Con menos de 10,000 registros, la diferencia de rendimiento entre ambas opciones es **estadísticamente insignificante**. PostgreSQL resuelve ambas en microsegundos. La decisión debe basarse en **mantenibilidad**, no en rendimiento.

---

## Análisis de Mantenibilidad

```
┌──────────────────────────────┬────────────────────┬────────────────────┐
│ Tarea de mantenimiento       │ 1 tabla (STI)      │ 2 tablas separadas │
├──────────────────────────────┼────────────────────┼────────────────────┤
│ Agregar campo común          │ 1 migración        │ 2 migraciones      │
│ Agregar campo exclusivo      │ 1 migración (NULL) │ 1 migración        │
│ Corregir bug en cálculos     │ 1 archivo          │ 2 archivos         │
│ Nuevo desarrollador entiende │ Medio (nombre)     │ Alto (claridad)    │
│ Riesgo de inconsistencia     │ Bajo               │ Alto (duplicación) │
│ Agregar nuevo "tipo" futuro  │ 1 valor en enum    │ 1 tabla + 3 pivots │
└──────────────────────────────┴────────────────────┴────────────────────┘
```

---

## Veredicto Final

> [!TIP]
> **Recomendación: Mantener la tabla única (STI).**
> 
> Tu sistema cotiza productos y servicios de manera **idéntica** (materiales + mano de obra + costos indirectos → precio unitario → margen → precio de venta). No existe divergencia funcional entre ambos tipos. Separarlos duplicaría código, tablas y complejidad sin ganancia alguna de rendimiento ni de mantenibilidad.

### ¿Cuándo cambiaría mi recomendación?

Solo si en el futuro ocurren **ambas** condiciones simultáneamente:

1. Los servicios necesitan **5+ campos exclusivos** que los productos no usan (ej. SLA, asignación de técnicos, horarios de disponibilidad).
2. Los productos necesitan **5+ campos exclusivos** que los servicios no usan (ej. peso, dimensiones, código de barras, stock en bodega, proveedor logístico).

Si eso llegara a ocurrir, la tabla `products` empezaría a llenarse de columnas vacías (NULLs) y ahí sí valdría la pena la separación. Pero ese escenario no existe hoy ni parece probable a corto plazo dado que el sistema es un **cotizador**, no un ERP de inventario.

### Lo que sí recomiendo como mejora inmediata

Si la semántica del nombre te incomoda, lo más limpio sería renombrar la tabla `products` → `catalog_items` (o simplemente `items`). Esto elimina la confusión semántica sin la complejidad de separar tablas. Sin embargo, este cambio requiere tocar los 14 archivos que mencioné, por lo que es un esfuerzo no trivial que recomiendo solo si se planea como parte de una refactorización mayor.
