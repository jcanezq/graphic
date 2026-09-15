# Arquitectura del Sistema CotiGrafix

Este documento describe la arquitectura técnica, estructura de datos y decisiones de diseño del sistema CotiGrafix.

## 1. Stack Tecnológico

El sistema está construido sobre una arquitectura moderna basada en React y Serverless:

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: CSS puro (CSS Modules / Global CSS) con un sistema de tokens (Design System)
- **Gestión de Estado y Fetching**: React Query (`@tanstack/react-query`)
- **Formularios**: React Hook Form (`react-hook-form`)
- **Validaciones**: Zod (`zod`, `@hookform/resolvers/zod`)
- **Iconos**: Lucide React (`lucide-react`)
- **Generación PDF**: jsPDF + autoTable

### Backend & Base de Datos
- **BaaS (Backend as a Service)**: Supabase
- **Base de Datos**: PostgreSQL
- **Autenticación**: Supabase Auth (Email/Password + OAuth Google)
- **Seguridad**: RLS (Row Level Security) activado en todas las tablas

---

## 2. Estructura de Directorios

La aplicación sigue la convención del App Router de Next.js:

```
src/
├── app/                  # Rutas de la aplicación (App Router)
│   ├── auth/             # Callbacks de autenticación
│   ├── dashboard/        # Layout principal y submódulos (Protegido)
│   │   ├── clientes/     # Gestión de clientes
│   │   ├── configuracion/# Ajustes del sistema (Perfil, Empresa)
│   │   ├── cotizaciones/ # Kanban y listado de cotizaciones
│   │   ├── materiales/   # Catálogo de materias primas
│   │   ├── productos/    # Catálogo de productos terminados
│   │   └── servicios/    # Catálogo de servicios (Filtro sobre products)
│   ├── login/            # Pantalla de inicio de sesión
│   ├── api/              # Endpoints de API (Ej: consulta de RUC)
│   ├── globals.css       # Design System y estilos globales
│   └── layout.tsx        # Layout raíz (Providers, Toast)
├── components/           # Componentes UI reutilizables
│   ├── products/         # Componentes específicos de productos (Materiales, Mano de obra)
│   ├── quotations/       # Componentes del cotizador (Kanban, Items)
│   ├── ui/               # Componentes genéricos (Botones, Inputs, Modales)
│   └── Sidebar.tsx       # Navegación principal
├── lib/                  # Utilidades y lógica de negocio
│   ├── supabase/         # Clientes de Supabase (browser/server)
│   ├── validations/      # Esquemas de Zod
│   ├── calculations.ts   # Motor de cálculo de precios y costos
│   └── pdf-export.ts     # Lógica de generación de PDF
└── types/                # Interfaces y tipos de TypeScript globales
```

---

## 3. Modelo de Datos (Esquema Relacional)

La base de datos en Supabase sigue un modelo altamente normalizado para los catálogos y un modelo transaccional "plano" (snapshot) para las cotizaciones.

### Entidades Principales:

1. **`clients`**: Almacena los datos de los clientes (RUC, DNI, Email, Dirección).
2. **`materials`**: Catálogo maestro de materias primas y sus costos unitarios.
3. **`categories`**: Categorización visual para productos/servicios (con colores y slugs).
4. **`products` (Single Table Inheritance)**:
   - Actúa como catálogo maestro tanto para **Productos** como para **Servicios** (diferenciados por la columna `type`).
   - Contiene la información base: código, nombre, margen por defecto, costo manual.
   - Tiene relaciones 1 a muchos con los desgloses de costos.
5. **Tablas de Desglose de Costos (Pivotes)**:
   - `product_materials`: Relaciona un producto con los materiales necesarios (cantidad).
   - `product_labor`: Mano de obra requerida (roles, horas, costo por hora).
   - `product_indirect_costs`: Costos indirectos asignados al producto.
6. **`quotations`**:
   - Cabecera de la cotización.
   - Contiene el cliente, estado (Kanban), validez, notas y totales calculados.
7. **`quotation_items`**:
   - **Crucial**: Actúa como un "Snapshot". Copia la configuración del producto en el momento de cotizar (nombre, costos de materiales, precios) para que si el catálogo cambia en el futuro, la cotización histórica no se vea alterada.

---

## 4. Lógica de Negocio y Flujo de Trabajo

### El Motor de Cálculos (`calculations.ts`)
Toda la lógica de precios está centralizada en funciones puras y testeadas:
- **Costo de Materiales**: Suma de `cantidad * material_actual.costo`. El costo del material siempre se lee "en vivo" de la tabla `materials` para reflejar variaciones de mercado.
- **Costo de Mano de Obra**: Suma de `cantidad * costo_por_hora`.
- **Costos Indirectos**: Suma plana de costos operativos.
- **Costo Total (Base)**: Materiales + Mano de Obra + Indirectos (o `manual_unit_cost` si se especifica).
- **Precio Unitario de Venta**: `Costo Total / (1 - (margen / 100))`. Este enfoque asegura que el margen de ganancia real sobre el precio de venta sea el esperado (Markup vs Margin).

### Flujo de Cotización
1. El usuario crea una nueva cotización y selecciona un cliente.
2. Agrega ítems desde el catálogo de Productos o Servicios.
3. El sistema lee el catálogo, calcula los costos actuales ("Live Pricing") usando `calculations.ts` y genera un "snapshot" en `quotation_items`.
4. El usuario puede modificar el ítem localmente en la cotización (cambiar cantidades, forzar un precio, alterar el margen) sin afectar el catálogo maestro.
5. Se calcula el Subtotal, IGV y Total de la cabecera `quotations`.

---

## 5. Decisiones Arquitectónicas Clave

### Single Table Inheritance (STI) para Productos y Servicios
En lugar de tener una tabla `products` y otra `services`, se utiliza una sola tabla discriminada por la columna `type`. 
**Razón**: El cotizador necesita combinar productos físicos y servicios de manera transparente. Ambos comparten la misma estructura de desglose de costos (Mano de obra, Materiales, Gastos indirectos) y flujo de márgenes. Separarlos requeriría duplicar tablas pivote y complicaría exponencialmente la lógica del cotizador.

### Filtros en el Dashboard
Las pantallas `/productos` y `/servicios` consultan la misma tabla de Supabase, aplicando los filtros `.eq('type', 'Producto')` y `.eq('type', 'Servicio')` respectivamente. React Query maneja el estado de estas vistas utilizando llaves de caché separadas (`['productos_list']` y `['servicios_list']`) para evitar colisiones.

### Middleware y Restricciones de Acceso
El archivo `middleware.ts` intercepta todas las peticiones a `/dashboard/*` verificando la sesión activa de Supabase. Además, contiene un sistema de "Whitelist" que solo permite el acceso a correos específicos (`ADMIN_EMAILS`), bloqueando el registro de usuarios no autorizados aunque utilicen Google OAuth.

### Diseño Visual (Design System)
El sistema utiliza una arquitectura CSS basada en variables (tokens) en `globals.css` (Paleta Indigo Profesional). No se utiliza Tailwind CSS (por decisión del cliente), sino CSS modular/clásico para mantener control total sobre la estética corporativa y las animaciones (micro-interacciones, sombras y glassmorphism).

### Catálogo Unificado (`CatalogBrowser`)
Para garantizar la máxima consistencia visual, tanto el catálogo público (Landing Page) como la selección de productos del Administrador (Nueva Cotización) comparten un único componente raíz: `CatalogBrowser`.
**Restricción de Seguridad:** Aunque el componente visual está unificado, **la capa de datos está estrictamente separada**. El API público `/api/public/products` omite intencionalmente los costos y márgenes para evitar fugas de datos comerciales, mientras que el administrador inyecta su consulta privilegiada desde Supabase Server Components, permitiéndole ver los costos unitarios (`showCost`) en tiempo real.

### Componentización de Miniaturas e Ítems
Siguiendo la regla de oro de **"Una sola fuente de verdad visual"**:
1. `ProductThumbnail`: Encapsula el renderizado de la imagen del producto, garantizando que el fallback (cuando no hay imagen) o el etiquetado sea el mismo en toda la app.
2. `QuoteItemThumb`: Componente interactivo (con selector numérico `+`/`-`) que gobierna cómo se ven los ítems añadidos al carrito. Se reutiliza tanto en la barra flotante del cliente como en el panel lateral resumen del administrador. Al no manejar estado propio, los eventos de cambio disparan las funciones del padre (`updateItem`), forzando una re-cuantificación atómica del subtotal general.

### Precios en el Administrador y Filtro por Costo Cero
Todos los cálculos de precios unitarios orientados al catálogo (antes de convertirse en una cotización transaccional) pasan obligatoriamente por la función compartida `buildCatalogPricing`. Esto erradicó la duplicación matemática y aseguró que el administrador deje de ver productos en "S/ 0.00" por falta de estimación en tiempo real. Adicionalmente, el sistema **oculta automáticamente de todos los catálogos** aquellos productos cuyo `manual_unit_cost` sea cero o nulo, reportándolos silenciosamente en el panel de control del administrador como incompletos.
