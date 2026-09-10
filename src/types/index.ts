// ============================================================
// CotiGrafix — Domain Types
// ============================================================

import type { Database } from './supabase';

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

export type Category = Tables<'categories'>;
export type Client = Tables<'clients'>;
export type ProductUnit = 'm²' | 'unidad' | 'kit' | 'servicio' | 'ml' | 'metro' | 'hora-técnico / visita' | 'm² de vehículo' | 'm² instalado' | 'm² de mueble/tabique';
export type Material = Tables<'materials'>;

export interface ProductMaterial extends Omit<Tables<'product_materials'>, 'id' | 'product_id'> {
  id?: string;
  product_id?: string;
  materials?: Pick<Material, 'id' | 'cost' | 'name' | 'unit'> | null;
}

export interface ProductLabor extends Omit<Tables<'product_labor'>, 'id' | 'product_id'> {
  id?: string;
  product_id?: string;
}

export interface ProductIndirectCost extends Omit<Tables<'product_indirect_costs'>, 'id' | 'product_id'> {
  id?: string;
  product_id?: string;
}

export interface Product extends Omit<Tables<'products'>, 'type' | 'unit'> {
  type: 'Producto' | 'Servicio' | 'Material';
  unit: ProductUnit;
  category?: Pick<Category, 'id' | 'name' | 'color' | 'slug'> | null;
  materials?: ProductMaterial[];
  labor?: ProductLabor[];
  indirect_costs?: ProductIndirectCost[];
  computed_material_cost?: number;
  computed_labor_cost?: number;
  computed_indirect_cost?: number;
  computed_unit_cost?: number;
}

export interface QuotationItem extends Omit<Tables<'quotation_items'>, 'id' | 'quotation_id' | 'item_type' | 'has_labor' | 'has_design' | 'design_cost' | 'has_transport' | 'transport_cost' | 'client_design_url' | 'labor_quantity' | 'labor_unit_cost' | 'labor_margin_percent' | 'design_quantity' | 'design_unit_cost' | 'design_margin_percent' | 'transport_quantity' | 'transport_unit_cost' | 'transport_margin_percent' | 'labor_scope' | 'design_scope' | 'transport_scope'> {
  id?: string;
  quotation_id?: string;
  item_type?: string | null;
  has_labor?: boolean | null;
  has_design?: boolean | null;
  design_cost?: number | null;
  has_transport?: boolean | null;
  transport_cost?: number | null;
  client_design_url?: string | null;
  client_design_file?: File | null;
  
  // Independent component fields
  labor_quantity?: number | null;
  labor_unit_cost?: number | null;
  labor_margin_percent?: number | null;
  design_quantity?: number | null;
  design_unit_cost?: number | null;
  design_margin_percent?: number | null;
  transport_quantity?: number | null;
  transport_unit_cost?: number | null;
  transport_margin_percent?: number | null;
  labor_scope?: string | null;
  design_scope?: string | null;
  transport_scope?: string | null;
}

export type QuotationStatus = 'solicitada' | 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'vencida' | 'pagado';

export interface Quotation extends Omit<Tables<'quotations'>, 'status'> {
  status: QuotationStatus;
  payment_method?: 'Yape' | 'Plin' | 'Efectivo' | 'Transferencia' | 'Tarjeta' | null;
  items?: QuotationItem[];
}

export type CompanySettings = Tables<'company_settings'>;

// Safe product representation for public client catalog (without internal costs/margins)
export interface PublicProduct {
  id: string;
  code: string;
  name: string;
  type: 'Producto' | 'Servicio' | 'Material';
  unit: ProductUnit;
  description: string;
  image_url: string | null;
  category_id: string | null;
  category_name?: string | null;
  unit_price: number;
  labor_price?: number;
  design_price?: number;
  transport_price?: number;
  material_price?: number;
  other_price?: number;
  /** Precio unitario de la fila BASE (sin componentes de servicio). */
  base_unit_price: number;
  /** Regla de escalado de cada componente, tal como la publica el catálogo. */
  labor_scope?: string;
  design_scope?: string;
  transport_scope?: string;
}

export interface ClientQuotationRequest {
  client_name: string;
  client_phone: string;
  client_email?: string;
  client_ruc?: string;
  client_address?: string;
  notes?: string;
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
}

// Form state helpers
export interface QuotationFormData {
  client_name: string;
  client_ruc: string;
  client_address: string;
  client_phone: string;
  client_email: string;
  items: QuotationItem[];
  notes: string;
  validity_days: number;
  igv_rate: number;
}

export interface ProductFormData {
  code: string;
  name: string;
  type: 'Producto' | 'Servicio' | 'Material';
  category_id: string;
  description: string;
  unit: ProductUnit;
  image_url: string;
  manual_unit_cost: number | null;
  default_margin: number;
  is_active: boolean;
  materials: ProductMaterial[];
  labor: ProductLabor[];
  indirect_costs: ProductIndirectCost[];
}
