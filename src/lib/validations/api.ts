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
