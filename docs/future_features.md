# Propuestas de Mejora y Nuevas Funcionalidades

Como Senior Developer, he analizado la estructura y el propósito de **CotiGrafic** (un sistema de cotización para una empresa gráfica). La base actual es excelente: tiene un modelo de costos detallado (materiales, mano de obra, indirectos) y un esquema de base de datos sólido. 

A continuación, presento un análisis de las funcionalidades que llevarían la aplicación al siguiente nivel (nivel "Enterprise"), divididas en 3 categorías clave.

---

## 1. Funcionalidades Core de Negocio (Business Value)

### 1.1. Generación y Envío de PDFs Profesionales
- **El Problema:** Actualmente las cotizaciones viven en el sistema, pero el cliente final necesita un documento presentable.
- **La Solución:** 
  - Implementar generación de **PDFs con diseño premium** (usando `@react-pdf/renderer` o HTML-to-PDF). 
  - Incluir el logo de la empresa, términos y condiciones, y un desglose claro.
  - Añadir un botón de **"Enviar por Email"** que use una API como Resend/SendGrid para enviar el PDF directamente desde la aplicación al cliente.

### 1.2. Gestión del Ciclo de Vida de Cotizaciones (Kanban)
- **El Problema:** Ver una tabla con estados ('borrador', 'enviada', 'aceptada') no da una visión rápida del "pipeline" de ventas.
- **La Solución:** Implementar una vista de **Tablero Kanban** (drag and drop) donde cada tarjeta sea una cotización. Así puedes mover fácilmente una cotización de "Enviada" a "Aceptada".

### 1.3. Control de Inventario (Stock) de Materiales
- **El Problema:** El sistema sabe cuánto cuesta un material, pero no sabe **cuántos quedan**.
- **La Solución:** 
  - Añadir columnas de `stock_actual` y `stock_minimo` a la tabla `materials`.
  - Cuando una cotización pase a estado "Aceptada", **descontar automáticamente** el material del inventario.
  - Alertas visuales de "Stock Bajo" en el Dashboard.

### 1.4. Historial y CRM Básico de Clientes
- **El Problema:** Los clientes son solo datos de contacto.
- **La Solución:** En la vista del cliente (`/dashboard/clientes/[id]`), mostrar todas las cotizaciones asociadas a ese cliente, el valor total de vida del cliente (LTV - cuánto ha comprado en total), y notas internas sobre la relación comercial.

---

## 2. Experiencia de Usuario Avanzada (UX/UI)

### 2.1. Actualización Masiva de Precios
- **Escenario:** El proveedor de acrílico sube sus precios un 10%.
- **Funcionalidad:** Una herramienta de **"Actualización Masiva"** donde puedas seleccionar múltiples materiales y aplicar un incremento porcentual (ej. +10%), recalculando automáticamente el costo de todos los productos que usen ese material.

### 2.2. Clonado / Versionado de Cotizaciones
- **Escenario:** El cliente pide un cambio menor en una cotización ya enviada. No deberías editar la enviada (por historial) ni empezar desde cero.
- **Funcionalidad:** Botón de **"Duplicar Cotización"** que genere una nueva con la revisión (ej. `COT-001-A`).

### 2.3. Dashboard Analítico (Business Intelligence)
- En la página principal (`/dashboard`), mostrar gráficos (usando `recharts` o `chart.js`):
  - Tasa de conversión: % de cotizaciones enviadas vs aceptadas.
  - Ingresos proyectados del mes.
  - Productos más cotizados.

---

## 3. Arquitectura y Código (Deuda Técnica)

### 3.1. Reemplazo de Tablas HTML por TanStack Table
- Implementar **TanStack Table (React Table v8)** para todas las tablas del sistema (Productos, Materiales, Clientes). Esto nos daría ordenamiento de columnas (sorting) instantáneo, filtros avanzados por columna, y ocultamiento de columnas de manera estandarizada y accesible.

### 3.2. Server Actions de Next.js 14
- Actualmente las mutaciones se hacen desde el cliente con Supabase JS y React Query. Podríamos refactorizar las operaciones críticas (como crear cotizaciones) a **Server Actions**, lo que aumenta la seguridad (no exponemos lógica en el cliente) y reduce el bundle JS.

### 3.3. Componentes UI Estándar (Design System)
- Reemplazar las clases manuales CSS por una librería de componentes de alta calidad como **shadcn/ui** (que usa Radix UI y Tailwind). Esto garantizaría modales, popovers, selectores de fecha y menús desplegables 100% accesibles y con animaciones profesionales.

---

> [!TIP]
> **¿Por dónde empezar?** 
> Si me permites sugerir, el mayor impacto inmediato para el negocio suele ser **la Generación de PDFs y envío de correos (1.1)**, seguido de la **Gestión del Ciclo de Vida tipo Kanban (1.2)**. 
> 
> Dime qué área te entusiasma más y crearé el plan de implementación detallado para construirlo juntos.
