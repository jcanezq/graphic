# Análisis Funcional de CotiGrafic (Perspectiva Senior)

He revisado a fondo el flujo funcional de la aplicación, enfocándome particularmente en el módulo de creación de cotizaciones (`nueva/page.tsx`) y el ciclo de vida del proceso de ventas. 

Actualmente, el sistema cumple perfectamente su propósito principal (MVP): calcular costos, estandarizar precios, generar PDFs y guardar un registro. Sin embargo, como herramienta B2B para una agencia gráfica, existen varias oportunidades para escalar el software y convertirlo en un mini-CRM.

Aquí presento mis sugerencias de implementación funcional, ordenadas por impacto en el negocio:

> [!IMPORTANT]
> **1. Revisiones de Cotizaciones (Versioning)**
> - **Problema actual:** Es común que los clientes pidan ajustes (ej. "bájale a 50 unidades" o "cambia el material"). Actualmente, tendrías que modificar la cotización original (perdiendo el registro inicial) o crear una completamente nueva.
> - **Solución sugerida:** Implementar un botón de **"Crear Revisión"**. Esto duplicaría la cotización actual, pero le asignaría un sufijo (ej. de `COT-2026-0001` pasaría a `COT-2026-0001-A`). Esto permite mantener el historial de negociación.

> [!TIP]
> **2. Módulo de Clientes (Mini-CRM)**
> - **Problema actual:** Los clientes se guardan silenciosamente en la base de datos cuando creas una cotización para habilitar el autocompletado, pero no hay forma de gestionarlos.
> - **Solución sugerida:** Crear una sección `/dashboard/clientes`. Al entrar al perfil de un cliente, podrías ver todo su historial de cotizaciones, cuánto dinero ha aprobado (LTV - Lifetime Value), y actualizar sus datos de contacto de forma centralizada.

> [!NOTE]
> **3. Descuentos Visibles (Psicología de Ventas)**
> - **Problema actual:** Puedes jugar con el `% de Margen` para bajar el precio, pero en el PDF final el cliente solo ve un precio unitario plano.
> - **Solución sugerida:** Agregar un campo opcional de "Descuento" (porcentaje o monto fijo) por ítem o en el total. Psicológicamente, mostrar en el PDF el precio original tachado y un "Descuento aplicado" aumenta significativamente la tasa de cierre de ventas.

> [!TIP]
> **4. Envío de Correos Integrado**
> - **Problema actual:** El flujo actual requiere descargar el PDF, abrir Gmail/Outlook, redactar el correo y adjuntar el archivo.
> - **Solución sugerida:** Integrar una API de correos (como **Resend** o **SendGrid**). Desde el detalle de la cotización, un botón "Enviar por Correo" podría generar el PDF en memoria, usar una plantilla de correo bonita con el logo de tu empresa, y enviarlo directamente al cliente con un solo clic.

> [!NOTE]
> **5. Alertas de Volatilidad de Costos**
> - **Problema actual:** Si duplicas una cotización de hace 6 meses, los ítems mantienen los costos congelados de ese momento. Si tus proveedores subieron los precios de los materiales, podrías perder dinero sin darte cuenta.
> - **Solución sugerida:** Al duplicar una cotización, el sistema debería cruzar los costos guardados vs los costos actuales en la base de datos de productos. Si hay una variación importante (ej. > 5%), debería mostrar una alerta visual: *"⚠️ Los costos de materiales para el producto X han subido desde la cotización original. Revisa tus márgenes."*

## Conclusión
Implementar el **Módulo de Clientes** y el **Envío de Correos** son probablemente los "Quick Wins" que más tiempo le ahorrarían a tu equipo de ventas en el día a día. ¿Te gustaría que planifiquemos la implementación de alguna de estas sugerencias?
