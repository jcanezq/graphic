// ============================================================
// CotiGrafix — Domain Types
// ============================================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon?: string;
  sort_order: number;
  created_at?: string;
}

export interface Client {
  id: string;
  name: string;
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

export type ProductUnit = 'm²' | 'unidad' | 'kit' | 'servicio' | 'ml' | 'metro';

export interface Material {
  id: string;
  name: string;
  unit: string;
  cost: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProductMaterial {
  id?: string;
  product_id?: string;
  material_id?: string | null;
  name: string;
  quantity: number;
  unit_cost: number;
  unit?: string;
  materials?: {
    id: string;
    cost: number;
    name: string;
    unit: string;
  } | null;
}

export interface ProductLabor {
  id?: string;
  product_id?: string;
  work_type: string;
  hours: number;
  hourly_rate: number;
}

export interface ProductIndirectCost {
  id?: string;
  product_id?: string;
  concept: string;
  cost: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  type: 'Producto' | 'Servicio';
  category_id: string | null;
  category?: Category;
  description?: string;
  unit: ProductUnit;
  image_url?: string;
  manual_unit_cost: number | null;
  default_margin: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Related data (joined)
  materials?: ProductMaterial[];
  labor?: ProductLabor[];
  indirect_costs?: ProductIndirectCost[];
  // Computed (client-side)
  computed_material_cost?: number;
  computed_labor_cost?: number;
  computed_indirect_cost?: number;
  computed_unit_cost?: number;
}

export interface QuotationItem {
  id?: string;
  quotation_id?: string;
  product_id?: string;
  sort_order: number;
  // Snapshot (immutable copy at quotation time)
  product_code?: string;
  product_name: string;
  product_description?: string;
  unit: string;
  material_cost: number;
  labor_cost: number;
  indirect_cost: number;
  unit_cost: number;
  // Quotation-specific
  quantity: number;
  margin_percent: number;
  unit_price: number;
  subtotal: number;
}

export type QuotationStatus = 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'vencida';

export interface Quotation {
  id: string;
  number: string;
  user_id: string;
  client_name: string;
  client_ruc?: string;
  client_address?: string;
  client_phone?: string;
  client_email?: string;
  items?: QuotationItem[];
  subtotal: number;
  igv_rate: number;
  igv: number;
  total: number;
  notes?: string;
  validity_days: number;
  status: QuotationStatus;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  id: string;
  company_name: string;
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  default_margin: number;
  igv_rate: number;
  quotation_prefix: string;
  quotation_next_number: number;
  updated_at?: string;
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
  type: 'Producto' | 'Servicio';
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
