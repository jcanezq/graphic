# Tarea: mantenedores de Categorías y Unidades de medida — CotiGrafic

Repo: `D:\proyectos\graph` (Next.js 14 App Router + Supabase). Antes de tocar nada lee
`docs/ARQUITECTURA.md`: es la referencia vigente y su §7 lista las reglas que no se rompen.
Trabaja en una rama nueva (`feat/mantenedores-categorias-unidades`), nunca directo en `main`.

## Objetivo

Que el administrador pueda mantener desde el panel, sin tocar código, las **categorías** y
las **unidades de medida**: agregarlas, editarlas y activarlas o desactivarlas. **Ninguna de
las dos se puede eliminar** (decisión de Jesús, 2026-11-09, para evitar inconsistencias). Hoy las categorías solo se editan en la base
y las unidades están fijas en el código.

## Estado actual (verificado el 2026-11-09)

**Categorías**
- La tabla `public.categories` existe en producción con `id, name, slug, color, icon,
  sort_order, deleted_at, created_at` (ver `src/types/supabase.ts`). Los productos la
  referencian con `products.category_id`.
- RLS en `supabase/migrations/20260909101500_f1_rls_isolation.sql:72-79`: escribe solo
  `is_admin()` y lee cualquier usuario autenticado (`deleted_at IS NULL`). A `anon` se le
  revocó el acceso.
- Se lee en `src/components/catalog/CatalogFormPage.tsx:81`, en
  `src/components/catalog/CatalogListPage.tsx:36` y en
  `src/app/api/public/products/route.ts:27`.
- ⚠️ **Ninguna migración crea la tabla** (`baseline.sql` no la menciona; solo hay políticas e
  índices). Entonces `supabase db reset` en local no la tiene. Verifícalo; si se confirma,
  la primera migración debe crearla con `CREATE TABLE IF NOT EXISTS` y exactamente las
  columnas que tiene producción.
- ⚠️ La ruta pública (`api/public/products/route.ts:27`) usa el cliente admin, que se salta
  RLS, y **no filtra `deleted_at`**: una categoría borrada seguiría saliendo en el catálogo
  público. Hay que corregirlo.

**Unidades**
- No existe tabla. La lista está copiada en **tres** lugares que tienen que coincidir:
  - `src/types/index.ts:11`: `type ProductUnit = 'm²' | 'unidad' | …`.
  - `src/lib/validations/product.ts:10`: `z.enum([...])`.
  - `src/components/products/BasicInfoSection.tsx:18-29`: `const UNITS` con su etiqueta.
- `products.unit` es TEXT sin CHECK. `quotation_items.unit` y `quotation_item_components.unit`
  guardan el texto como foto fija.
- `product_labor.unit` (por defecto `'hora'`) y `product_indirect_costs.unit` (por defecto
  `'global'`) también son texto libre. **Quedan fuera de esta tarea**, salvo que se decida
  otra cosa.

## Qué construir

### 1. Base de datos (migraciones nuevas con `supabase migration new <nombre>`)

- **`categories`**: créala solo si falta (ver la advertencia de arriba). Agrega
  `UNIQUE(slug)` si no existe, verificando antes que no haya slugs duplicados. Agrega
  también la columna `is_active boolean not null default true`, para poder desactivar.
  `deleted_at` se queda, pero la aplicación ya no lo escribe.
- **Tabla `units`** nueva:
  `id uuid pk default gen_random_uuid()`, `code text not null unique` (el valor que se guarda,
  por ejemplo `m²`), `label text not null` (por ejemplo «Metro cuadrado (m²)»),
  `sort_order int`, `is_active boolean not null default true`, `created_at`, `updated_at`.
  Usa el trigger de `updated_at` que ya existe (`20260909111500_f3_updated_at_triggers.sql`).
- **Seed** en la misma migración, con las 10 unidades actuales y las etiquetas de
  `BasicInfoSection.tsx`, en el mismo orden. Antes, consulta
  `SELECT DISTINCT unit FROM products` en producción: si aparece un valor que no está en la
  lista, inclúyelo en el seed. **No modifiques los productos.**
- **FK** `products.unit → units(code)` con `ON UPDATE RESTRICT ON DELETE RESTRICT`. Créala
  `NOT VALID` y luego `VALIDATE`, una vez confirmado que no hay huérfanos.
- **No pongas FK** en `quotation_items.unit` ni en `quotation_item_components.unit`: son
  fotos fijas y deben conservar el texto aunque la unidad cambie o se desactive
  (ARQUITECTURA §3).
- **RLS** en `units`: `admin_insert_units` (`FOR INSERT`) y `admin_update_units`
  (`FOR UPDATE`), ambas con `is_admin()`, y `auth_read_units` (`SELECT` para usuarios
  autenticados). **No crees política de DELETE.** Aplica `REVOKE ALL ON units FROM anon`,
  `REVOKE DELETE ON units FROM authenticated` y limita el UPDATE a las columnas editables:
  `REVOKE UPDATE ON units FROM authenticated` y luego
  `GRANT UPDATE (label, sort_order, is_active) ON units TO authenticated`. Así el `code` no
  se puede cambiar después de crear la unidad.

### 2. Reglas de negocio

- **Ni las categorías ni las unidades se eliminan, nunca** (decisión de Jesús, 2026-11-09).
  No hay botón de eliminar. Lo que existe es **activar y desactivar** (`is_active`), y se
  puede reactivar en cualquier momento.
- **Qué hace la desactivación, igual para las dos:** el elemento desactivado no aparece en
  los selectores al crear o editar un producto. Un producto que ya lo tiene lo sigue
  mostrando, con la marca «(inactiva)», y se puede guardar sin cambiarlo. Las cotizaciones
  guardadas no cambian.
- **Categoría desactivada en el catálogo público:** desaparece de la lista de categorías y de
  los filtros, pero sus productos siguen visibles (confirmado por Jesús, 2026-11-09). Ocultar
  un producto es decisión de su propio `is_active`, no de su categoría.
- **Unidades:** el `code` no se edita después de crear la unidad; solo la etiqueta, el orden
  y el estado.
- **Categorías:** se pueden editar el nombre, el color, el icono, el orden y el estado. El
  slug se genera desde el nombre al crearla, debe ser único y **después no se edita**.
- **Esto se impone también en la base, no solo en la interfaz**: en una migración, reemplaza
  `admin_write_categories` (hoy es `FOR ALL`, que permite DELETE) por dos políticas,
  `admin_insert_categories` (`FOR INSERT`) y `admin_update_categories` (`FOR UPDATE`), ambas
  con `is_admin()`, y **sin política de DELETE**. Además, ejecuta
  `REVOKE DELETE ON public.categories FROM authenticated` y limita el UPDATE a las columnas
  editables: `REVOKE UPDATE ON public.categories FROM authenticated` y luego
  `GRANT UPDATE (name, color, icon, sort_order, is_active) ON public.categories TO authenticated`.
  Así nadie puede cambiar el slug ni el `deleted_at` desde el cliente. Para `units` se hace lo
  mismo (ver la sección 1).
- Antes de cerrar `auth_read_categories`, ten en cuenta que hoy filtra `deleted_at IS NULL`.
  Déjala así: los usuarios autenticados deben poder leer las categorías inactivas, porque un
  producto existente puede tener una.
- Toda escritura pasa por RLS. Si la haces con rutas API, valida además con
  `src/lib/auth/guards.ts`, como las rutas existentes.

### 3. Interfaz

- Páginas nuevas `src/app/dashboard/categorias/page.tsx` y
  `src/app/dashboard/unidades/page.tsx`. Imita `dashboard/clientes`, que ya tiene tabla y
  modal (`ClientTable.tsx` y `ClientModal.tsx`): React Query, toasts con `ToastProvider`,
  estilos de `globals.css`. **No agregues Tailwind ni librerías de componentes.**
- Categorías: botón «Nueva categoría», edición de nombre, color, icono y orden, e interruptor
  activo/inactivo. El slug se muestra pero no se edita. La lista muestra cuántos productos
  tiene cada una.
- Unidades: botón «Nueva unidad», edición de etiqueta y orden, e interruptor activo/inactivo.
  El código se muestra pero no se edita. La lista muestra cuántos productos la usan.
- **En ninguna de las dos pantallas hay acción de eliminar.** Al desactivar un elemento que
  usan productos, pide confirmación indicando cuántos son.
- Agrega los dos enlaces en `src/components/Sidebar.tsx`. Verifica que el middleware y el
  layout del dashboard ya protejan `/dashboard/*` para admin.

### 4. Cambiar las unidades fijas por la tabla

- `BasicInfoSection.tsx`: el selector carga `units` (activas, por `sort_order`), igual que
  `CatalogFormPage` ya carga `categories`. Si el producto tiene una unidad inactiva, el
  selector la muestra igual.
- `validations/product.ts`: `unit` pasa a `z.string().min(1)`. La FK es la que valida.
- `types/index.ts`: `ProductUnit` pasa a `string`, o se deriva de `Tables<'units'>`. Revisa
  con `npm run typecheck` todos los usos (`Product`, el producto público y el formulario).
- Regenera `src/types/supabase.ts` con `supabase gen types` si tienes acceso; si no, edítalo a
  mano y déjalo anotado en el PR.
- El selector de categoría (`BasicInfoSection.tsx`, que recibe las categorías desde
  `CatalogFormPage.tsx:81`) sigue la misma regla que el de unidades: muestra solo las
  activas, más la que ya tenga el producto aunque esté inactiva.
- En `api/public/products/route.ts:27`, filtra `deleted_at IS NULL` e `is_active = true` en
  la lista de categorías. No ocultes los productos de una categoría inactiva.

## Fuera de alcance

- Las unidades de `product_labor` y `product_indirect_costs`.
- Las «categorías» del modelo de costos (`material`, `labor`, `production`, `other` en
  `quotation_item_components`): son otra cosa, tienen un CHECK fijo y **no se tocan**.
- Cambiar el motor de precios (`buildCatalogPricing`, `calculations.ts`).

## Criterios de aceptación

1. Un admin crea la unidad «millar», la usa en un producto, la cotiza, y el PDF muestra
   «millar».
2. Si después cambia la etiqueta de «millar», las cotizaciones guardadas siguen igual (foto
   fija).
3. Desactivar «millar» la saca del selector de productos nuevos, el producto que ya la usa se
   sigue editando, y al reactivarla vuelve al selector. Con una categoría pasa lo mismo, y
   además desaparece de los filtros del catálogo público, aunque sus productos siguen a la
   vista.
4. Ninguna de las dos pantallas ofrece eliminar. Con la sesión de un admin, y no con el
   service role, un `DELETE` directo a `categories` o a `units` **falla**, igual que un
   `UPDATE` de `categories.slug`, `categories.deleted_at` o `units.code`. Crear, editar los
   campos permitidos y activar o desactivar sí funciona.
5. Un usuario autenticado que no es admin **no puede** escribir en `units` ni en
   `categories`: pruébalo con su sesión, no con el service role.
6. `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` terminan en verde.
   Agrega pruebas de Vitest para lo que tenga lógica (por ejemplo el generador de slugs y la
   regla de unidad inactiva en el selector).
7. Las migraciones aplican limpias sobre una base local (`supabase db reset`) y son
   idempotentes.

## Cómo entregar

- Haz commits chicos por paso (BD, interfaz de categorías, interfaz de unidades, cambio de
  las listas fijas).
- Abre un PR contra `main` con los pasos para probar cada criterio y la salida de los cuatro
  comandos.
- **No apliques migraciones en producción** sin el visto bueno de Jesús. Primero ejecuta
  `SELECT DISTINCT unit FROM products` y comparte el resultado.
- Actualiza `docs/ARQUITECTURA.md` en dos lugares: §3, modelo de datos (tabla `units` y FK),
  y §7, con las reglas de que el `code` no se edita, de que las fotos fijas no llevan FK y de
  que ni las categorías ni las unidades se eliminan: solo se desactivan.
