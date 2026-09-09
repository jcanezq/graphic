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
    .regex(/^\d{11}$/, "El RUC debe tener 11 dígitos.")
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
