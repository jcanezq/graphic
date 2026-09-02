import { z } from "zod";

export const productSchema = z.object({
  code: z.string().min(1, "El código es requerido"),
  name: z.string().min(1, "El nombre es requerido"),
  type: z.enum(["Producto", "Servicio"]),
  category_id: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unit: z.enum(["m²", "unidad", "kit", "servicio", "ml", "metro"]),
  manual_unit_cost: z.number().nullable().optional(),
  useManualCost: z.boolean(),
  default_margin: z.number().min(0),
  is_active: z.boolean(),
  materials: z.array(z.object({
    material_id: z.string().nullable().optional(),
    name: z.string(),
    quantity: z.number().min(0),
    unit_cost: z.number().min(0),
    unit: z.string(),
  })),
  labor: z.array(z.object({
    work_type: z.string(),
    hours: z.number().min(0),
    hourly_rate: z.number().min(0),
  })),
  indirects: z.array(z.object({
    concept: z.string(),
    cost: z.number().min(0),
  }))
});

export type ProductFormValues = z.infer<typeof productSchema>;
