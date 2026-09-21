import { z } from "zod";

// Cotas deliberadas. Sin techo, un POST con 100.000 ítems o quantity = 1e308
// se convierte en denegación de servicio barata y en NUMERIC fuera de rango.
export const MAX_ITEMS_PER_QUOTATION = 50;
export const MAX_QUANTITY_PER_ITEM = 10_000;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const clientQuotationItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce
    .number()
    .finite()
    .positive()
    .max(MAX_QUANTITY_PER_ITEM)
    .default(1),
  has_labor: z.boolean().default(true),
  has_design: z.boolean().default(true),
  has_transport: z.boolean().default(true),
  /** Observación libre de esta línea, escrita por el cliente. Se acota el
   *  largo acá: es texto libre que viaja desde el navegador. */
  notes: z.string().trim().max(2000).optional().nullable(),
  /** Ruta del arte dentro del bucket privado `client-art`: `<uid>/<archivo>`.
   *  NO es una URL. El servidor comprueba además que el <uid> sea el de la
   *  sesión — ver route.ts. La forma se acota acá para que no entre una URL
   *  pública heredada ni una ruta con `..`. */
  client_design_url: z
    .string()
    .trim()
    .max(400)
    .regex(
      /^[0-9a-fA-F-]{36}\/[A-Za-z0-9._-]+$/,
      "La ruta del arte no tiene la forma esperada.",
    )
    .optional()
    .nullable(),
  /**
   * SUBC — Qué filas de la receta quiere el cliente, y cuáles no.
   *
   * Es la lista COMPLETA de subcomponentes que él vio, cada uno con su clave y
   * su interruptor. Va completa a propósito: sin las filas apagadas el servidor
   * no puede distinguir «esto lo destildó» de «esto apareció después y él nunca
   * lo vio», que es la diferencia entre no cobrarlo y cobrarlo avisando.
   *
   * REEMPLAZA a `included_component_ids`, que pedía UUIDs de
   * `quotation_item_components` — filas que en ese momento TODAVÍA NO EXISTEN,
   * porque el servidor acaba de reconstruir la receta del catálogo. Aquella
   * lista no podía coincidir con nada y el filtro caía siempre en «incluir
   * todo»: el cliente destildaba y se le cobraba igual. La clave de contenido
   * la calcula `src/lib/component-selection.ts`, la misma función que usa el
   * catálogo público al publicarla.
   *
   * §7.12: acá NO entra un solo precio. `key` dice CUÁL fila es, `included` si
   * la quiere; el costo, el margen y la cantidad salen del catálogo, en el
   * servidor. Cualquier otro campo que mande el navegador lo descarta zod.
   */
  component_selection: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(300),
        included: z.boolean(),
      }),
    )
    .max(200, "Demasiados subcomponentes.")
    .optional()
    .nullable(),
});


export const clientQuotationSchema = z.object({
  client_name: z.string().trim().min(1, "El nombre o razón social es obligatorio.").max(200),
  client_phone: z
    .string()
    .trim()
    .min(6, "El número de teléfono o WhatsApp es obligatorio.")
    .max(30),
  client_email: z.string().trim().email().max(200).optional().nullable().or(z.literal("")),
  client_ruc: z
    .string()
    .trim()
    // RUC (11) o DNI (8). La columna clients.ruc guarda los dos y el tipo se
    // deduce del largo; ver docs/ARQUITECTURA.md §3. El esquema de /api/ruc
    // (más abajo) SÍ exige 11: esa ruta consulta SUNAT, que sólo tiene RUC.
    .regex(/^(\d{8}|\d{11})$/, "El documento debe tener 8 dígitos (DNI) u 11 (RUC).")
    .optional()
    .nullable()
    .or(z.literal("")),
  client_address: optionalText(300),
  notes: optionalText(2000),
  /** Días de vigencia. Sólo lo respeta el servidor cuando quien pide es
   *  administrador; para el resto vale 15. Ver 43-spec-UNIF. */
  validity_days: z.number().int().min(1).max(365).optional(),
  /**
   * El total que el cliente vio en pantalla y aceptó al enviar, con IGV.
   *
   * ⚠ NO PARTICIPA DEL PRECIO, y esto no es un detalle de implementación: es la
   * regla §7.12. El servidor recalcula todo desde el catálogo y este número
   * solamente se COMPARA con el resultado, para poder avisarle al cliente
   * cuando difiere. Si alguna vez aparece en una suma o en un producto, el
   * cliente pasa a fijar su propio total y la regla dejó de valer.
   */
  accepted_total: z.number().finite().nonnegative().max(1e12).optional().nullable(),
  items: z
    .array(clientQuotationItemSchema)
    .min(1, "Debes incluir al menos un producto o servicio.")
    .max(MAX_ITEMS_PER_QUOTATION, `Máximo ${MAX_ITEMS_PER_QUOTATION} ítems por cotización.`),
});

export type ClientQuotationInput = z.infer<typeof clientQuotationSchema>;

export const rucQuerySchema = z.object({
  ruc: z.string().regex(/^\d{11}$/, "El RUC debe tener 11 dígitos."),
});

export const dniQuerySchema = z.object({
  dni: z.string().regex(/^\d{8}$/, "El DNI debe tener 8 dígitos."),
});
