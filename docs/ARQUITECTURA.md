# Arquitectura del Sistema CotiGrafix

> **Actualizado: 2026-09-16**, verificado contra el código en `5405846`. Cada afirmación de este
> documento se comprobó ejecutando o leyendo el archivo que se cita. **Si algo acá no coincide con
> el código, el código manda y este documento está vencido: corregilo.**

Documento para quien vaya a trabajar en el sistema. Describe cómo está construido, por qué, y
sobre todo **qué reglas no se pueden romper** — la sección 7 es la más importante si tenés poco
tiempo.

---

## 1. Stack Tecnológico

### Frontend
- **Framework**: Next.js 14.2 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: CSS puro con un sistema de tokens en `globals.css`. **No se usa Tailwind**, por
  decisión del dueño.
- **Estado y fetching**: React Query (`@tanstack/react-query`)
- **Formularios y validación**: React Hook Form + Zod
- **Iconos**: `lucide-react` (con una excepción documentada en §7.6)
- **Exportación**: jsPDF + autoTable (`lib/pdf-export.ts`), ExcelJS (`lib/excel-export.ts`)

### Backend y base de datos
- **BaaS**: Supabase — PostgreSQL 17, Auth y Storage
- **Autenticación**: Supabase Auth (correo/contraseña + Google OAuth)
- **Autorización**: RLS en todas las tablas, más una lista blanca de correos en el middleware
- **Pruebas**: Vitest (24 pruebas en `src/lib/__tests__/`)

---

## 2. Estructura de Directorios

Verificada contra el árbol real:

```
src/
├── app/
│   ├── page.tsx              # Pantalla principal PÚBLICA: catálogo + panel lateral del carrito
│   ├── cotizar/              # Detalle de la cotización del cliente (edición + datos de contacto)
│   ├── mis-cotizaciones/     # Historial del cliente + [id]/ = pantalla de entrega (§5.4)
│   ├── login/  ·  auth/      # Sesión y callbacks OAuth
│   ├── dashboard/            # Zona protegida
│   │   ├── clientes/         # Mantenedor de clientes (RUC y DNI)
│   │   ├── configuracion/    # Perfil y datos de la empresa
│   │   ├── cotizaciones/     # Listado, Kanban y [id]/ — nueva/ SÓLO redirige (§5.2)
│   │   ├── materiales/  ·  productos/  ·  servicios/   # Tres vistas sobre la MISMA tabla
│   ├── api/
│   │   ├── public/products/  # Catálogo público — SIN costos ni márgenes
│   │   ├── public/settings/  # Datos públicos de la empresa (§6.5)
│   │   ├── client/quotations/# Alta de cotización desde la pantalla del cliente
│   │   ├── ruc/  ·  dni/     # Consulta a SUNAT y RENIEC
│   │   ├── me/               # Identidad y rol del usuario
│   │   ├── pdf/[id]/         # Generación del PDF
│   │   └── quotations/[id]/email/   # Envío de la cotización por correo (Resend)
│   └── globals.css           # Sistema de tokens y estilos globales
├── components/
│   ├── catalog/              # CatalogBrowser · CatalogFormPage · CatalogListPage
│   ├── public/               # ProductCard · ProductThumbnail · QuoteItemThumb · PublicNavbar
│   ├── products/             # Secciones del formulario de producto (materiales, mano de obra…)
│   ├── quotations/           # Kanban (Board, Column, Card)
│   └── dashboard/            # Gráficos
├── lib/
│   ├── calculations.ts       # Motor de costos y precios del catálogo
│   ├── pricing.ts            # Precio de la línea de cotización
│   ├── quotation-item-row.ts # Mapper ÚNICO de persistencia de ítems
│   ├── ruc.ts                # Consulta unificada de RUC y DNI
│   ├── formatters.ts · whatsapp.ts · rate-limit.ts · api-error.ts
│   └── __tests__/            # calculations · pricing-consistency · whatsapp
├── middleware.ts             # Protección de /dashboard/* + lista blanca
└── types/
```

**No existe** `components/ui/`. Los componentes genéricos viven donde se usan.

---

## 3. Modelo de Datos

Catálogos normalizados; cotizaciones como **instantánea** (*snapshot*).

### Entidades

1. **`clients`** — datos del cliente. **La columna `ruc` guarda RUC (11 dígitos) o DNI (8); el
   tipo se deduce del largo.** El nombre de la columna miente y renombrarla se descartó por
   riesgo: la usan cinco pantallas.

2. **`products` — herencia de tabla única (STI).** Una sola tabla para **Productos, Servicios y
   Materiales**, discriminada por la columna `type`. Las vistas `/productos`, `/servicios` y
   `/materiales` son tres filtros sobre ella, con claves de caché distintas en React Query.

   **Productos y Servicios se comportan igual:** los dos pueden tener materiales, mano de obra e
   indirectos, y el motor de precios nunca los distinguió. **Los Materiales no**: su costo es
   `manual_unit_cost`, cargado a mano. Por eso el formulario condiciona el desglose con
   `type !== "Material"` — nunca con `=== "Servicio"`, que fue el bloqueo que hubo hasta el
   2026-09-15.

   > **La tabla `materials` está MUERTA.** No queda ninguna referencia en `src/` (verificado con
   > `grep`). Un material es una fila de `products` con `type = 'Material'`, y su costo vive en
   > `products.manual_unit_cost`. Si ves documentación o código que hable de una tabla
   > `materials`, está desactualizado.

3. **`categories`** — categorización visual.

4. **Tablas de desglose de costos**, todas 1→N contra `products`:
   - `product_materials` — qué materiales lleva y en qué cantidad
   - `product_labor` — mano de obra (horas × tarifa)
   - `product_indirect_costs` — indirectos, discriminados por `kind`

5. **`quotations`** — cabecera: cliente, estado (Kanban), validez, notas, subtotal, IGV y total.

6. **`quotation_items`** — **instantánea** de cada línea. **`client_design_url` ya no guarda una
   URL: guarda la RUTA del arte dentro del bucket privado `client-art`** (`<uid>/<archivo>`). El
   nombre miente por historia, igual que `clients.ruc`; se documenta y no se renombra, porque la
   columna viaja por el mapper único y por el RPC. Los valores que empiezan con `http` son
   heredados y **ya no resuelven**. Ver §6.4. Copia nombre, costos y precios del
   momento de cotizar, para que un cambio posterior en el catálogo no altere una cotización
   histórica. Incluye las nueve columnas de componentes (mano de obra, diseño y transporte, cada
   uno con cantidad, costo, margen y alcance) y, desde el 2026-09-15, **`notes`**: la observación
   libre de esa línea.

### Vistas

- **`clients_with_stats`** — clientes con su conteo de cotizaciones, LTV y última fecha.
  **No la consulta ninguna pantalla** (el panel de clientes calcula el LTV en JavaScript). Ver
  §6.3: fue el origen de una fuga de datos.

---

## 4. El motor de precios

### 4.1 La fórmula — leé esto antes de tocar cualquier número

```
precio = costo × (1 + margen / 100)
```

Es **markup sobre el costo**, y está en `calculations.ts:83` (`calcUnitPrice`) y en
`pricing.ts:75`. **El margen se aplica SOBRE EL COSTO, no sobre el precio de venta.**

> **⚠ Versiones anteriores de este documento decían `costo / (1 − margen/100)`. Es FALSO.** Esa
> es la fórmula de margen sobre precio, que el dueño descartó explícitamente. Confundirlas cambia
> todos los precios del sistema: con un margen del 35 %, un costo de S/ 40 da **S/ 54.00** con la
> fórmula correcta y S/ 61.54 con la otra.
>
> Una consecuencia útil: con markup, **el precio es cero si y sólo si el costo es cero** (un
> margen de 0 devuelve el costo). Por eso se puede filtrar el catálogo por precio — ver §7.3.

### 4.2 Cómo se compone el costo

`buildCatalogPricing` (`calculations.ts:116`) es **la única función que calcula precios de
catálogo**. La usan la ruta pública, la pantalla del administrador y las pruebas.

```
costoBase  = manual_unit_cost   (si está cargado y es > 0)
           | materiales + indirectos-otros   (si no)

precioBase = costoBase × (1 + margen/100)

precioUnitario = precioBase
               + manoDeObra × (1 + margen/100)
               + diseño     × (1 + margen/100)
               + transporte × (1 + margen/100)
```

> **La mano de obra NO entra en el costo base.** Entra recién en el precio unitario, como
> componente separado, para poder desglosarla en la cotización. **Consecuencia que ya causó un
> defecto:** un servicio cuyo costo es todo mano de obra tiene `base_unit_price = 0` y
> `unit_price > 0`. Ver §7.3.

> ### ⚠ Qué hace exactamente `manual_unit_cost`
>
> Cuando está cargado **reemplaza** al costo base —materiales e indirectos «otros»—, pero **la
> mano de obra, el diseño y el transporte se siguen sumando por encima**. O sea que en un artículo
> con costo manual, cargarle materiales **no cambia nada** y cargarle mano de obra **sí sube el
> precio**. No es un descuido: el costo manual sustituye la receta, no los servicios asociados.
>
> Es la asimetría que hacía que el resumen del formulario mostrara un precio distinto al del
> catálogo —tenía su propia aritmética—. Desde el 2026-09-15 ese panel llama a
> `buildCatalogPricing`, así que las dos cifras coinciden siempre.

### 4.3 Las cuatro categorías, y dónde viven el diseño y el transporte

Un producto o un servicio se compone de **cuatro categorías**, ni una más. Es el modelo del
negocio, declarado por el dueño el 2026-09-15:

| Categoría | Tabla | Componente opcional que contiene |
|---|---|---|
| **Mano de Obra** | `product_labor` | toda la categoría es opcional |
| **Materiales/Insumos** | `product_materials` | ninguno |
| **🏭 Producción** | `product_indirect_costs` | **Diseño** |
| **📦 Otros** | `product_indirect_costs` | **Transporte** |

**El diseño y el transporte NO son categorías: son ítems dentro de Producción y de Otros.**
«Diseño gráfico (prorrateado)» es un costo de producción; «Transporte y logística» es uno de otros.

La columna `kind` de `product_indirect_costs` se lee como una **jerarquía**, no como cuatro
valores sueltos:

```
🏭 Producción  →  kind = 'production'   fila normal
              →  kind = 'design'       fila MARCADA como componente opcional

📦 Otros      →  kind = 'other'        fila normal
              →  kind = 'transport'    fila MARCADA como componente opcional
```

En el formulario eso es **una casilla por fila** dentro de esas dos secciones, no una sección
aparte. Marcarla es lo que permite al cliente quitar ese costo de su cotización.

> ### ⚠ Lo que NO hay que reintroducir
>
> Hasta el 2026-09-16 el motor caía a **emparejar por el texto del concepto** cuando no encontraba
> un `kind`: buscaba `diseno`/`design` y `transporte`/`movilidad`/`flete`, sin tildes. **Eso se
> retiró**, y no debe volver. Tenía tres defectos de fondo:
>
> - una regla que decide **dinero** quedaba escrita en texto libre: renombrar un concepto cambiaba
>   un precio, en silencio;
> - era `includes()`, así que «Transporte de personal» —un gasto general— se convertía en una
>   línea que el cliente podía **apagar**;
> - tomaba **la primera** coincidencia, y el orden de las filas no estaba definido.
>
> Hoy la clasificación es explícita y **`sumIndirectByKind` suma TODAS las filas de un tipo**: si un
> artículo tiene «Diseño gráfico» y «Diseño personalizado», los dos son diseño.

### 4.4 Alcance de los componentes

Cada componente tiene un `scope`: `'unit'` (se multiplica por la cantidad) u `'order'` (se cobra
una vez por cotización). Los valores heredados son `labor: 'unit'`, `design: 'order'`,
`transport: 'order'`.

### 4.5 Recálculo de una línea

`recalcQuotationItem` (`calculations.ts`) recalcula una línea al cambiar cantidad, costo, margen o
componentes.

> **⚠ Su lista de `overrides` es CERRADA** (cantidad, margen, costo y los doce campos de
> componentes) y su `return` esparce el ítem **anterior**, no los overrides. Pasarle un campo que
> no está en la lista **lo descarta en silencio** — y como la llamada usa `as any`, el compilador
> no avisa. Por eso las observaciones por ítem **no pasan por esta función**: usan un setter propio
> (`updateItemNotes`). Todo lo que no sea un número que afecte al precio debe seguir ese camino.

---

## 5. Flujo de cotización

### 5.1 Cliente

1. **Pantalla principal** (`app/page.tsx`): catálogo + panel lateral derecho con los ítems
   agregados (miniatura, descripción, precio y selector de cantidad).
2. **«Ver mi cotización»** lleva a **`/cotizar`**, donde el cliente edita cantidades, activa o
   desactiva componentes opcionales, **escribe observaciones por ítem** y completa sus datos.
3. El borrador vive en `localStorage` bajo la clave `cotigrafic_quote_items`, y se escribe
   siempre por `persistItems` / `persistQuote`, que además emiten el evento
   `cotigrafic_cart_updated` que sincroniza el contador del carrito.
4. **La sesión se pide antes que los datos del formulario.** Al tocar «Generar Cotización» sin
   sesión aparece el modal «Registra tu Cotización», no un mensaje sobre un campo vacío. El orden
   importa: el nombre que escribiera un visitante **se descarta** al volver del ingreso, porque
   gana el de la cuenta de Google (`cotizar/page.tsx:158`).
5. **El documento se verifica solo.** En cuanto el RUC o el DNI queda completo (8 u 11 dígitos),
   se consulta una única vez por número, con 600 ms de espera. Si falla, **calla**: el usuario no
   pidió nada y puede escribir el nombre a mano. El botón «Consultar» sí reporta el error.
6. **Si desmarca el diseño, adjunta su arte ahí mismo** — sólo con sesión iniciada, porque las
   políticas del bucket exigen que la carpeta sea su `uid`. El archivo va directo a `client-art`
   desde el navegador y en el borrador queda **la ruta**, no una URL.
7. Se guarda por `POST /api/client/quotations` y la pantalla **navega a la página de entrega**,
   `/mis-cotizaciones/<id>` (§5.4).

### 5.2 Administrador

**Desde el 2026-09-16 el administrador no tiene cotizador propio: recorre el mismo circuito que el
cliente.** `dashboard/cotizaciones/nueva` quedó reducida a una redirección al catálogo, y con ella
desapareció el botón «Guardar Cotización».

1. Arma la cotización en el catálogo público y en `/cotizar`, exactamente como un cliente.
2. Ahí ve **dos campos que el cliente no ve, y sólo esos**: el **buscador de clientes del CRM** por
   nombre y la **validez en días**. El título del formulario pasa a decir «Datos del Cliente».
3. Genera con «Generar Cotización» y cae en la misma página de entrega (§5.4).
4. **El costo y el margen los ajusta después**, en la cotización guardada
   (`dashboard/cotizaciones/[id]`), que los edita por ítem **y por cada componente**.

El privilegio no se adivina en el navegador: la pantalla le pregunta a `/api/me` qué es la sesión —y
eso sólo decide **qué campos se dibujan**—, mientras **el servidor lo comprueba por su cuenta**.
`POST /api/client/quotations` sólo respeta `validity_days` si quien pide es administrador —un
cliente que mandara 3650 se estaría regalando diez años de precio congelado—, y sólo a él le ahorra
el prefijo «[Solicitud Web de Cliente]» y le guarda la cotización como `borrador` en vez de
`solicitada`.

> **Por qué un solo cotizador y no dos pantallas gemelas.** Se corrigieron dos veces defectos que
> estaban en las dos pantallas y se arreglaron en una sola —la posición de las observaciones y la
> del arte adjunto—, y las dos veces hubo que volver a pedirlo. Dos pantallas que «deben verse
> igual» divergen; una sola no puede divergir de sí misma.

### 5.3 Identificación del cliente

`fetchDocumentData` (`lib/ruc.ts`) es la **única** función de consulta: decide por el largo del
número si va a `/api/ruc` (SUNAT, 11 dígitos) o a `/api/dni` (RENIEC, 8) y normaliza las dos
respuestas. La usan las tres pantallas. Con DNI **la dirección llega vacía y eso es normal**:
RENIEC no expone domicilio.

> Si las consultas devuelven **503 «Servicio de consulta no disponible»**, falta `APISPERU_TOKEN`
> en el entorno. No es un defecto del código.

### 5.4 La entrega: una página con URL propia

Al generar, la aplicación navega a **`/mis-cotizaciones/<id>`**, que ofrece las tres entregas.

Antes esto era un estado dentro de `/cotizar`, y tenía tres problemas: no tenía URL, no se podía
volver a ella, y **al recargar desaparecía** — la cotización quedaba guardada pero la pantalla que
la entregaba se perdía.

Cuelga de `/mis-cotizaciones` a propósito: el middleware ya protege todo lo que empieza con ese
prefijo, así que **no hubo que agregar una cuarta regla** sobre quién puede ver qué.

| Entrega | Cómo |
|---|---|
| **PDF** | `GET /api/pdf/<id>` — exige sesión; el administrador ve todo y el resto sólo lo suyo |
| **Correo** | `POST /api/quotations/<id>/email` — Resend, con el PDF adjunto |
| **WhatsApp** | enlace armado en el navegador con `generateClientToAdminWhatsAppUrl` |

**El destinatario del correo no viene del cuerpo de la petición**: sale de la cotización, que ya se
comprobó que es de quien pide. Si el cuerpo pudiera elegirlo, la ruta sería un **relé de correo
abierto** — bastaría registrarse para mandar correo a cualquiera firmado con el dominio de la
empresa. Con el destinatario fijo, el techo del abuso es mandarse correo a uno mismo.

> **Dos cosas que todavía no están probadas.** El correo necesita `RESEND_API_KEY` y `RESEND_FROM`
> con un dominio verificado: el código compila, pero **nadie lo vio funcionar**. Y el «Enviado ✓»
> del botón es sólo visual —vive en el estado de la página—, así que **una recarga permite reenviar
> sin límite**; el freno del lado del servidor está pendiente (§8).

---

## 6. Seguridad

### 6.1 Capas

1. **Middleware** (`src/middleware.ts`) — protege `/dashboard/*` y aplica una lista blanca por
   `ADMIN_EMAILS`. **Sin esa variable, nadie es administrador.**
2. **RLS** en todas las tablas. Verificado: un anónimo recibe `42501 permission denied` en
   `clients`, `quotations`, `quotation_items`, `products` y `user_roles`.
3. **`public.is_admin()`** — resuelve por `service_role` en el JWT o por una fila en `user_roles`
   con `role = 'admin'`.

### 6.2 La API pública no expone costos

`/api/public/products` **omite deliberadamente** `manual_unit_cost`, `default_margin` y todo campo
de costo. El aviso está escrito en el propio archivo (`route.ts:10`) y es una **línea roja**:
ver §7.1.

### 6.3 Dos incidentes reales, y su lección

**(a) `clients_with_stats` abierta a internet.** La vista se creó con un `CREATE VIEW` pelado, sin
`security_invoker`. Una vista de Postgres corre con los permisos de **quien la creó**, así que el
RLS de `clients` no se evaluaba: cualquiera con la clave anónima —que es pública por diseño, viaja
en el JavaScript del navegador— obtenía la cartera completa de clientes con teléfonos y correos.
Se corrigió con `security_invoker = true` más un `REVOKE` para `anon`
(`20260915180000`). **Cerrada y verificada el 2026-09-15:** la misma consulta anónima que devolvía
seis clientes hoy responde `42501 permission denied for view`.

**(b) El RPC perdió su endurecimiento sin que nadie lo notara.** `replace_quotation_items` fue
endurecida (`SECURITY INVOKER`, `search_path` fijo, validación de entrada, guarda de propiedad y
recálculo transaccional de totales) y **seis días después otra migración la redefinió con
`CREATE OR REPLACE` para agregarle tres columnas**, borrando las cinco protecciones. Quedó como
`SECURITY DEFINER` —que evita el RLS— sin guarda de propiedad y ejecutable por cualquier usuario
autenticado.

> **La lección, que vale para toda la base:** `CREATE OR REPLACE FUNCTION` **reemplaza la
> definición completa** —cuerpo, `SECURITY`, `SET search_path`—, no la parchea, y no avisa de lo
> que borra. **Antes de redefinir una función que ya existe, leé su última definición entera y
> arrastrá todo lo que no estés cambiando a propósito.**

---

### 6.4 El almacenamiento: qué es público y qué no

Cuatro buckets, con límites puestos **por configuración** — que es la única capa que el navegador
no puede eludir, porque el cliente habla directo con la API de Storage:

| Bucket | Público | Tope | Qué guarda |
|---|---|---|---|
| `product-images` | **sí** | 10 MB | las fotos del catálogo. Escritura sólo de administrador |
| `company-assets` | **sí** | 5 MB | el logo de la empresa |
| **`client-art`** | **NO** | 50 MB | **el arte que suben los clientes** |
| `client-designs` | **cerrado** | — | bucket heredado. Se cerró el 2026-09-16 |

**El arte del cliente nunca se sirve directo.** Va por `GET /api/art?path=…`, que comprueba la
sesión, comprueba la propiedad y devuelve un `302` a una **URL firmada de cinco minutos**.

La propiedad **vive en la ruta**: el primer segmento es el `uid` de quien subió, y las políticas de
`client-art` lo exigen comparando `(storage.foldername(name))[1] = auth.uid()::text`. Por eso la
ruta se arma siempre como `<uid>/<archivo>` — **cambiarle la forma hace que la subida falle con
403**, no con un error claro.

> **El 404 de `/api/art` es deliberado y es el mismo para «no existe» y «no es tuyo».** Un 403
> confirmaría que el archivo existe. Mismo criterio que `/api/pdf/[id]`.

#### Por qué se cerró `client-designs`

Sus cuatro políticas **no miraban de quién era el archivo**:

```sql
FOR SELECT TO public         -- lo leía cualquiera, sin cuenta
FOR INSERT TO authenticated  -- escribía cualquier usuario registrado
FOR DELETE TO authenticated  -- BORRABA el archivo de otro cliente
FOR UPDATE TO authenticated  -- lo SOBRESCRIBÍA
```

No era sólo lectura pública: cualquier cliente con cuenta podía destruir el arte de otro. Se cerró
con `20260916140000`, y la comprobación no es el código de estado sino **el cuerpo de la
respuesta**: `client-designs` devuelve `NoSuchBucket` y `product-images` devuelve `NoSuchKey`. Los
dos dan HTTP 400; sólo el cuerpo los distingue.

### 6.5 `company_settings` es del administrador, y el membrete se lee con el rol de servicio

`company_settings` guarda **`default_margin`**. Por eso su política es
`FOR ALL TO authenticated USING (public.is_admin())`
(`20260909101500_f1_rls_isolation.sql:109-115`): para un cliente autenticado **no devuelve ninguna
fila**.

Eso tuvo roto el PDF del cliente durante una semana sin que nadie lo notara. La ruta encontraba la
cotización —el filtro por dueño estaba bien— y después pedía la configuración **con la sesión del
usuario**; al no volver fila respondía `404 {"error":"Settings not found"}`. **El mensaje señalaba
la cotización y el que faltaba era el membrete.**

**La política está bien; lo que estaba mal era a quién se le preguntaba.** El membrete —nombre,
RUC, dirección, teléfono, correo y logo— es dato de la empresa, no del usuario: se lee con
`createAdminClient()` **después** de haber autorizado, y **nombrando las seis columnas**.
`default_margin` no aparece en ningún `select`, y `generatePDF` deja ese contrato escrito en su
firma (`PdfCompanySettings`).

Lo mismo valía para el teléfono de WhatsApp, que las pantallas del cliente leían desde el
navegador: volvía vacío y el enlace caía al **número de relleno** de `whatsapp.ts:31`, de modo que
cada cliente que tocaba el botón le escribía a un número ajeno a la empresa. Hoy sale por
**`GET /api/public/settings`**, que entrega los mismos cuatro campos que `/api/public/products` ya
le daba a cualquier visitante anónimo — sin superficie nueva.

---

## 7. Reglas que no se rompen

Cada una nació de un defecto real. Romperlas vuelve a traerlo.

### 7.1 El cliente nunca ve costo ni margen
Es una decisión del dueño, no una preferencia de diseño. El catálogo está unificado en
`CatalogBrowser`, compartido por las dos pantallas, y la diferencia se expresa **con la bandera
`showCost`**. Si alguna vez la única forma de compartir un componente parece ser exponer el costo,
**la respuesta es la bandera, no la excepción**.

### 7.2 Una sola fuente de verdad por cálculo
El precio llegó a calcularse de **cinco maneras distintas** en este proyecto, y la cotización a
guardarse por dos caminos que no coincidían. Hoy:

| Cálculo | Función única |
|---|---|
| Precio de catálogo | `buildCatalogPricing` (`calculations.ts:116`) |
| Precio de una línea | `calcUnitPrice` / `recalcQuotationItem` |
| **Persistencia de un ítem** | **`toQuotationItemRow`** (`lib/quotation-item-row.ts`) |
| Resumen de costos del formulario | `buildCatalogPricing` — tenía su propia aritmética hasta el 2026-09-15 |

**Agregar una columna a `quotation_items` = tocar sólo `quotation-item-row.ts`.** Los cinco
caminos de guardado pasan por ahí: la API del cliente, la nueva cotización del administrador,
Duplicar, Nueva versión y la edición de `[id]`.

> **Excepción que hay que recordar:** el camino de `[id]` entrega la fila al RPC
> `replace_quotation_items`, que **enumera sus columnas a mano en SQL**. Una columna nueva necesita
> *también* una migración que actualice esa función, o se pierde en silencio al editar.

### 7.3 El catálogo oculta lo que no tiene precio, y el criterio es `unit_price`
Se ocultan los ítems con `unit_price = 0`, que con la fórmula de markup equivale exactamente a
«no tiene costo cargado». Al administrador se le informa cuántos quedaron ocultos.

> **No uses `manual_unit_cost`**: sólo lo tienen los materiales; en un Producto o un Servicio es
> `NULL` porque su costo se calcula. **No uses `base_unit_price`**: vale 0 para un servicio cuyo
> costo es todo mano de obra (§4.2). Las dos cosas se intentaron y las dos ocultaron el catálogo.

### 7.4 Elegir dos veces el mismo producto agrega dos líneas
Es deliberado: evita crear productos casi duplicados que sólo difieren en color o acabado — la
diferencia se escribe en la observación de cada línea. Para conseguir más unidades idénticas está
el selector de cantidad.

Por eso cada línea lleva un **`row_key`** propio, generado al agregarla. **Es un dato de
presentación y no se guarda en la base**: da identidad a la línea para React, de modo que borrar
una no arrastre la observación de otra. Lo mismo vale para `image_url` en el ítem del
administrador: **si el mapper de persistencia pasara a copiar el ítem con *spread*, estos campos
harían fallar el guardado con `42703`**.

### 7.5 NINGUNA imagen pasa por el optimizador de Next
Se sirven todas directo de Supabase Storage, con `<img>`, nunca con `next/image`. La razón está
escrita en `ProductThumbnail.tsx`: el costo del plan Pro de Vercel, la cláusula comercial del plan
Hobby y una vulnerabilidad del optimizador de Next 14.

**La regla estuvo aplicada a medias durante semanas** —las pantallas públicas la respetaban y tres
del administrador no— y eso consumía cuota y mantenía abierta la superficie del CVE sin que nadie
lo viera. Se cerró el 2026-09-16.

**El control no es el `grep`, es la pestaña Red del navegador:** ninguna petición debe ir a
`/_next/image`. Todas deben venir de `…supabase.co/storage/…`.

> Al traducir un `<Image>` a `<img>`: `fill` no existe —se reemplaza por `position:absolute;
> inset:0; width:100%; height:100%` con el contenedor en `position:relative`— y `sizes` se elimina.
> `alt` se conserva siempre.

### 7.6 El `+` del botón de agregar está dibujado a mano
El ícono `Plus` de `lucide-react` dibuja su cruz de 5 a 19 dentro de un `viewBox` de 24: **sólo
ocupa el 58 % de su caja**, y ese porcentaje no es configurable. Subir `size` rinde la mitad de lo
esperado y el techo llega antes del objetivo — por encima de 46 px el `<svg>` no entra en el botón
y `flex` lo deforma. Por eso ese botón usa un `<svg>` propio cuya cruz ocupa el 83 % de la caja.

### 7.7 Una migración escrita no es una migración aplicada
El archivo `.sql` no cambia nada hasta `supabase db push`. Se comprueba con
`supabase migration list --linked`: la migración tiene que aparecer en **las dos** columnas,
`local` y `remote`.

### 7.8 Verificar el artefacto que el usuario está mirando
Un build local no prueba nada sobre un sitio publicado, y el fuente no prueba nada sobre lo que
entrega el servidor. Para comprobar qué está corriendo de verdad:

```bash
curl -s http://localhost:3000/_next/static/chunks/app/page.js | grep -c '<lo que buscás>'
```

### 7.9 Nunca pongas CSS ni JavaScript como texto dentro del JSX
React **escapa** el texto que renderiza, y `<style>` y `<script>` son **RAWTEXT** para el
navegador: dentro de ellos las entidades **no se decodifican**. Las dos reglas juntas convierten un
`>`, un `<` o un `&` en dos defectos a la vez.

Pasó, y costó encontrarlo: un `<style>` dentro de `app/page.tsx` con el selector
`.catalog-layout > *` llegaba al navegador como `.catalog-layout &gt; *`. Consecuencias:

1. **Error de hidratación en la raíz** —React compara `>` contra `&gt;`—, y la página entera se
   volvía a renderizar en el cliente.
2. **La regla CSS quedaba inválida y el navegador la descartaba** — y era justamente la que impide
   que la fila de chips empuje el panel del carrito fuera de la pantalla.

**El CSS va en `globals.css`.** Si alguna vez parece imprescindible generarlo en el componente,
`dangerouslySetInnerHTML` evita el escapado — pero deja la mina puesta para el siguiente.

### 7.10 Una regla de negocio vive en CADA capa que la valida
No alcanza con arreglarla donde se guarda. El «11 dígitos» del documento estaba escrito **tres
veces** —en la pantalla del administrador, en la del cliente y en el esquema Zod del servidor— y
arreglar las dos del navegador dejó la tercera esperando en el peor lugar: el formulario aceptaba
un DNI, RENIEC devolvía el nombre, y el guardado lo rechazaba al final.

**Cuando cambies una regla así, el `grep` no va sobre el nombre del campo: va sobre la regla
misma** (`\d{11}`, en aquel caso). Y revisará tres capas: navegador, servidor y base.

### 7.11 Un formulario que borra y reinserta debe reinsertar TODO lo que cargó

`CatalogFormPage` guarda los costos de un artículo así: **borra todas** sus filas y **reinserta**
las que tiene en memoria. Es un patrón legítimo, pero tiene una condición que no está escrita en
ninguna parte del código: **todo lo que se borra tiene que haberse cargado antes.**

Se rompió exactamente ahí. El filtro de carga repartía las filas en dos cajones —`'production'` y
`'other'`— y una fila con `kind = 'design'` **no caía en ninguno**: no llegaba al formulario, y el
guardado la borraba de la base. **No se degradaba: desaparecía**, con su costo, y el componente
dejaba de existir en las cotizaciones futuras de ese artículo. Sin ningún error.

**La regla:** cuando un formulario use borrar-y-reinsertar, la suma de sus cajones de carga tiene
que cubrir **todos** los valores posibles de la columna que los discrimina. Si mañana se agrega un
`kind` nuevo, hay que agregarlo al filtro **en el mismo commit**.

**El control barato:** después de guardar, contar las filas. Si salieron menos de las que entraron
y nadie borró nada a mano, el filtro de carga tiene un agujero.

### 7.12 El servidor reconstruye los ítems del cliente: lo que no se asigna, se pierde

`POST /api/client/quotations` **no confía en el cuerpo de la petición**. De cada línea toma
únicamente la **cantidad** y los **tres interruptores** de componentes, y vuelve a construir el
ítem desde el catálogo con `createQuotationItemFromProduct` (`route.ts:113-131`). Por eso el
cliente no puede falsear un precio.

**La consecuencia, que hay que tener presente al agregar cualquier campo:** todo lo que venga del
cliente y deba persistir hay que **asignarlo explícitamente después** de esa reconstrucción. Pasó
con la ruta del arte; volverá a pasar con lo próximo.

Y hay dos maneras de equivocarse, las dos silenciosas:

1. **Pasarlo por `recalcQuotationItem`.** Su lista de `overrides` es cerrada y la llamada usa
   `as any`: un campo que no esté en la lista **se descarta sin que el compilador diga nada**.
   Ver §4.5.
2. **Aceptarlo sin comprobar de quién es.** El arte se guarda como `<uid>/<archivo>`, y el servidor
   **verifica que ese `uid` sea el de la sesión** antes de aceptarlo
   (`route.ts:137-139`). Sin esa línea, alguien podría adjuntar a su propia cotización la ruta del
   archivo de otro: no podría leerlo —`/api/art` compara con la sesión— pero **el administrador
   sí**, y lo abriría creyendo que es el arte de ese pedido.

> **Ante una ruta ajena o vencida se descarta en silencio y la cotización se guarda igual.** Es
> deliberado y es comercial: una ruta ajena es un intento, una ruta vieja de una pestaña abierta
> hace rato es un accidente, y en los dos casos guardar el pedido sin el arte es mejor que perder
> la venta.

### 7.13 Una ruta probada sólo con el administrador no está probada

En una aplicación con RLS **el administrador atraviesa políticas que para todos los demás son
paredes**, y eso lo convierte en el peor usuario posible para verificar nada. El PDF del cliente
estuvo roto mientras el del administrador salía perfecto, y la ruta de correo nació con el mismo
defecto por copiar el patrón del PDF dando por sentado que funcionaba.

**Toda ruta que un cliente pueda tocar se prueba con una sesión de cliente**, y ese caso se escribe
en el spec. Cuando el defecto aparezca, vale además §7.8: **mirar el cuerpo que devuelve la ruta**
antes de armar una hipótesis. Acá decía `Settings not found`, y esas dos palabras eran la causa
entera.

### 7.14 Una ruta que usa el rol de servicio declara `force-dynamic`

Next adelanta trabajo al compilar. Si una ruta de API no tiene ninguna señal de que su respuesta
dependa de la petición, **la ejecuta durante el build**, guarda el resultado y en producción sirve
esa copia sin volver a ejecutarla.

Para una ruta que va a la base con `createAdminClient()` eso falla de dos maneras, y **la segunda
es peor que la primera**:

1. **Donde no está la clave, el build revienta.** El CI no tiene `SUPABASE_SERVICE_ROLE_KEY` —ni
   debe tenerla, es la llave maestra— así que la ejecución en tiempo de compilación muere con
   `Error occurred prerendering page`.
2. **Donde sí está la clave, el dato queda congelado en la compilación.** Cambiar el teléfono de la
   empresa en Configuración no cambiaría nada hasta el próximo despliegue, y el síntoma sería un
   número viejo sin ningún error a la vista.

`/api/public/products` lo declaraba desde siempre y **nadie sabía para qué**;
`/api/public/settings` nació sin eso y lo delató el CI (`45c1e2c`). Sin este arreglo habríamos
corregido el número de relleno del WhatsApp para reemplazarlo por un número congelado: el botón
seguiría mal, pero de una forma mucho más difícil de encontrar.

> **El corolario es lo que más vale: un build local NO prueba que el build del CI pase.** Tu
> máquina tiene `.env.local` con secretos que el CI no tiene, y esa diferencia es deliberada. El
> fallo se reproduce en un comando:
>
> ```
> SUPABASE_SERVICE_ROLE_KEY="" npm run build
> ```
>
> Es la misma idea de §7.8 y §7.13: **probar en las condiciones equivocadas da un verde que no
> vale.**

---

## 8. Estado y pendientes conocidos

| Asunto | Estado |
|---|---|
| Migraciones | **39 aplicadas**; la fuga de `clients_with_stats` cerrada y el arte del cliente en privado |
| Cotizador | **unificado**: el administrador usa el circuito público; `cotizaciones/nueva` sólo redirige |
| Entrega | página propia con PDF, correo y WhatsApp (§5.4) |
| Correo | **escrito y sin probar** — falta `RESEND_API_KEY` y `RESEND_FROM` con dominio verificado |
| Reenvío de correo | **sin freno del lado del servidor**: recargar la página permite reenviar sin límite |
| Teléfono de la empresa | cargado como `888888888` — **no es un número al que WhatsApp pueda escribir**; es dato, no código |
| Imágenes | plan completo: buckets cerrados, cero optimizador, arte privado con entrega firmada |
| Integración continua | `ci.yml` verde con los cuatro pasos (typecheck, lint, test, build) |
| `@emnapi/core` y `@emnapi/runtime` en `devDependencies` | **declaradas a propósito y nada las importa**: sin ellas `npm ci` falla en Linux. No las borres (`3a97960`) |
| Protección de rama `main` | **desactivada** — el CI avisa pero no bloquea |
| `db-types.yml` | nunca se ejecutó; le falta el secreto `SUPABASE_ACCESS_TOKEN` |
| Pruebas | 24, en el motor de cálculo, la consistencia de precios y WhatsApp |
| Cobertura de interfaz | sin pruebas automatizadas de componentes |

---

## 9. Glosario de decisiones

| Decisión | Dónde vive la razón |
|---|---|
| STI para productos, servicios y materiales | §3.2 |
| **Productos y servicios comparten componentes; los materiales no** | §3.2 |
| Markup en vez de margen sobre precio | §4.1 |
| **El costo manual sustituye la receta, no los servicios asociados** | §4.2 |
| **Cuatro categorías de costo; diseño y transporte son ítems marcados, no categorías** | §4.3 |
| **La clasificación es explícita: el emparejamiento por texto se retiró** | §4.3 |
| **Borrar-y-reinsertar exige que los cajones de carga cubran todo** | §7.11 |
| **La sesión se pide antes que los datos del formulario** | §5.1 |
| **El documento se verifica solo, y falla callado** | §5.1 |
| Catálogo compartido con bandera `showCost` | §7.1 |
| Un mapper único de persistencia | §7.2 |
| Líneas repetidas en vez de sumar cantidad | §7.4 |
| `<img>` en vez de `next/image`, **en todo el proyecto** | §7.5 |
| **El arte del cliente es privado y se entrega firmado** | §6.4 |
| **La propiedad del archivo vive en la ruta, no en una columna** | §6.4 |
| **`client_design_url` guarda una ruta, no una URL** | §3 · §6.4 |
| **El cliente adjunta su arte, sólo con sesión** | §5.1 |
| **Lo que el cliente manda se asigna DESPUÉS de reconstruir el ítem** | §7.12 |
| **Un solo cotizador: el administrador recorre el circuito del cliente** | §5.2 |
| **La confirmación es una página con URL, no un estado de pantalla** | §5.4 |
| **El destinatario del correo sale de la cotización, nunca del cuerpo** | §5.4 |
| **`company_settings` es del administrador; el membrete se lee con el rol de servicio** | §6.5 |
| **Una ruta probada sólo con el administrador no está probada** | §7.13 |
| **Una ruta con el rol de servicio declara `force-dynamic`, o el build la ejecuta** | §7.14 |
| Sin galería, sin requisitos de arte, sin validación por contenido | decisión del dueño, 2026-09-16 |
| **CSS en la hoja de estilos, nunca como texto en el JSX** | §7.9 |
| CSS con tokens en vez de Tailwind | §1 |

**Paleta vigente**: monocroma con un rojo de precio — `--accent: #191919`, `--bg-primary: #f5f5f5`,
`--bg-secondary: #FFFFFF`, `--text-primary: #191919`, **`--price: #ec0936`**. El rojo es
exclusivamente para precios y totales; los botones primarios van en `--accent`.
