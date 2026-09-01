# Contexto del Proyecto: CotiGrafic

**Fecha de actualización:** 31 de Agosto de 2026
**Propósito:** Documento de contexto general técnico y de negocio para reuniones de equipo.

---

## 1. Visión General del Proyecto
**CotiGrafic** es un sistema interno (B2B) diseñado para la gestión y creación de cotizaciones profesionales enfocadas en servicios gráficos y publicitarios (impresión gran formato, señalética, merchandising, rotulado vehicular, etc.).
Su objetivo es estandarizar los precios, mantener un histórico inmutable de las cotizaciones y agilizar el proceso de ventas.

## 2. Stack Tecnológico (Actualizado)
El proyecto ha sido recientemente optimizado y se encuentra bajo el siguiente stack moderno:

*   **Frontend / Framework:** Next.js 14 (App Router) + React 18.
*   **Backend & Base de Datos:** Supabase (PostgreSQL) + Auth + Storage.
*   **Gestión de Estado y Caché:** React Query (`@tanstack/react-query`). Implementado para un manejo de datos asíncronos rápido y eficiente en cliente.
*   **Testing:** Vitest (Pruebas unitarias para lógica de costos).
*   **Estilos:** Vanilla CSS (`globals.css`) basado en un sistema de diseño propio (variables CSS) limpio y corporativo, sin depender de librerías externas pesadas.
*   **Generación de Archivos:** `jspdf` y `jspdf-autotable` para exportar las cotizaciones.

## 3. Arquitectura y Seguridad
*   **Server Components (RSC):** Vistas como el *Dashboard* y el *Catálogo* han sido refactorizadas a componentes de servidor para reducir el JavaScript enviado al cliente y mejorar sustancialmente el rendimiento de carga inicial.
*   **Autenticación y Autorización:** Se utiliza Supabase Auth. El sistema está protegido adicionalmente por un **Middleware** que implementa una validación por **lista blanca de correos** (`ADMIN_EMAILS`). Solo correos autorizados pueden acceder, protegiendo la herramienta de registros no deseados.
*   **Base de Datos (RLS):** Todas las tablas de Supabase tienen `Row Level Security` habilitado, garantizando que las consultas desde el cliente sean seguras.

## 4. Reglas de Negocio Implementadas
*   **Numeración Atómica de Cotizaciones:** Se resolvió el problema de colisión de números de cotización utilizando una función RPC de PostgreSQL (`generate_quotation_number`) con la cláusula `FOR UPDATE`, que garantiza números secuenciales exactos incluso bajo concurrencia.
*   **Histórico de Precios (Snapshots):** La tabla `quotation_items` toma una "fotografía" del precio, nombre y descripción del producto en el momento exacto en que se cotiza. Esto asegura que si los costos de un material suben mañana, las cotizaciones de ayer no se alteran de forma retrospectiva.
*   **Motor de Cálculo Blindado:** La lógica de rentabilidad, suma de costos directos (materiales, mano de obra) e indirectos, y márgenes de ganancia (`src/lib/calculations.ts`) cuenta ahora con un conjunto de **pruebas unitarias** automatizadas, garantizando que CotiGrafic jamás calcule mal un centavo.

## 5. Próximos Pasos (Oportunidades Futuras)
Para la próxima fase del proyecto o futuras reuniones, se sugiere considerar:
1.  **Tipado Automático:** Implementar `supabase gen types` para que los tipos de TypeScript se sincronicen automáticamente con cualquier cambio que se haga en las tablas de PostgreSQL. (Requiere token de acceso del administrador).
2.  **Migración total a React Query:** Actualmente, la página de Productos fue migrada a React Query con éxito. Se recomienda hacer lo mismo progresivamente con la creación y edición de Cotizaciones.
3.  **Generación de PDFs Server-Side:** Para cotizaciones extremadamente largas o con muchas imágenes, considerar mover la generación del PDF (`jspdf`) a una Edge Function de Supabase o una ruta de API de Next.js para no bloquear el navegador del cliente.

---
*Este documento resume el estado técnico del sistema tras las recientes auditorías y optimizaciones estructurales (React Query, Server Components, Testing).*
