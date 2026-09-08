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

export interface QuotationItem extends Omit<Tables<'quotation_items'>, 'id' | 'quotation_id'> {
  id?: string;
  quotation_id?: string;
  item_type?: string;
  has_labor?: boolean;
  has_design?: boolean;
  design_cost?: number;
  client_design_url?: string;
  client_design_file?: File | null;
}

export type QuotationStatus = 'solicitada' | 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'vencida';

export interface Quotation extends Omit<Tables<'quotations'>, 'status'> {
  status: QuotationStatus;
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
  material_price?: number;
  other_price?: number;
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
