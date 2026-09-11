"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, type ProductFormValues } from "@/lib/validations/product";
import type { Category, Material } from "@/types";

import { BasicInfoSection } from "@/components/products/BasicInfoSection";
import { MaterialsSection } from "@/components/products/MaterialsSection";
import { LaborSection } from "@/components/products/LaborSection";
import { IndirectCostsSection } from "@/components/products/IndirectCostsSection";
import { CostSummarySection } from "@/components/products/CostSummarySection";

export interface CatalogFormPageProps {
  type: "Producto" | "Servicio" | "Material";
  basePath: string;
  labels: { 
    titleNew: string; 
    titleEdit: string; 
    subtitleNew: string; 
    successNew: string; 
    successEdit: string;
  };
}

export default function CatalogFormPage({ type, basePath, labels }: CatalogFormPageProps) {
  const router = useRouter();
  const params = useParams();
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();

  const isNew = params.id === "nuevo";
  const productId = isNew ? null : (params.id as string);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [masterMaterials, setMasterMaterials] = useState<Material[]>([]);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: "",
      name: "",
      type: type,
      category_id: "",
      description: "",
      unit: "unidad",
      useManualCost: false,
      manual_unit_cost: null,
      default_margin: 30,
      is_active: true,
      image_url: null,
      materials: [],
      labor: [],
      production_costs: [],
      other_costs: []
    }
  });

  const fetchMasterMaterials = useCallback(async () => {
    const { data } = await supabase.from("products").select("id, name, manual_unit_cost, unit").eq("type", "Material").eq("is_active", true).order("name");
    const formatted = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      cost: p.manual_unit_cost || 0,
      unit: p.unit || "unidad"
    }));
    setMasterMaterials(formatted as Material[]);
  }, [supabase]);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setCategories((data as Category[]) || []);
  }, [supabase]);

  const fetchProduct = useCallback(async () => {
    const [prodRes, matRes, labRes, indRes] = await Promise.all([
      supabase.from("products").select("*").eq("id", productId).single(),
      supabase.from("product_materials").select("*, material_ref:products!product_materials_material_id_fkey(id, manual_unit_cost, name, unit)").eq("product_id", productId),
      supabase.from("product_labor").select("*").eq("product_id", productId),
      supabase.from("product_indirect_costs").select("*").eq("product_id", productId),
    ]);

    if (prodRes.data) {
      const p = prodRes.data;
      form.reset({
        code: p.code || "",
        name: p.name || "",
        type: p.type || type,
        category_id: p.category_id || "",
        description: p.description || "",
        image_url: p.image_url || null,
        unit: p.unit || "unidad",
        manual_unit_cost: p.manual_unit_cost,
        useManualCost: p.manual_unit_cost != null,
        default_margin: Number(p.default_margin),
        is_active: p.is_active,
        materials: (matRes.data || []).map((m: any) => ({
          ...m,
          unit_cost: m.material_ref?.manual_unit_cost ?? m.unit_cost,
          name: m.material_ref?.name ?? m.name,
          unit: m.material_ref?.unit ?? m.unit
        })),
        labor: labRes.data || [],
        production_costs: indRes.data?.filter((ic: any) => ic.kind === 'production') || [],
        other_costs: indRes.data?.filter((ic: any) => !ic.kind || ic.kind === 'other') || []
      });
    }
    setLoading(false);
  }, [supabase, productId, form, type]);

  useEffect(() => {
    fetchCategories();
    fetchMasterMaterials();
    if (productId) fetchProduct();
  }, [productId, fetchCategories, fetchMasterMaterials, fetchProduct]);

  const onSubmit = async (values: ProductFormValues) => {
    setSaving(true);
    
    const productData = {
      code: values.code,
      name: values.name,
      type: values.type,
      category_id: values.category_id || null,
      description: values.description,
      image_url: values.image_url || null,
      unit: values.unit,
      manual_unit_cost: values.useManualCost ? values.manual_unit_cost : null,
      default_margin: values.default_margin,
      is_active: values.is_active,
      updated_at: new Date().toISOString(),
    };

    let savedId = productId;

    if (isNew) {
      const { data, error } = await supabase.from("products").insert(productData).select().single();
      if (error) {
        showToast("Error: " + error.message, "error");
        setSaving(false);
        return;
      }
      savedId = data.id;
    } else {
      const { error } = await supabase.from("products").update(productData).eq("id", productId);
      if (error) {
        showToast("Error: " + error.message, "error");
        setSaving(false);
        return;
      }
      // Delete existing related data to re-insert
      await Promise.all([
        supabase.from("product_materials").delete().eq("product_id", productId),
        supabase.from("product_labor").delete().eq("product_id", productId),
        supabase.from("product_indirect_costs").delete().eq("product_id", productId),
      ]);
    }

    // Insert related data
    if (values.materials.length > 0) {
      await supabase.from("product_materials").insert(
        values.materials.map((m) => ({
          product_id: savedId,
          material_id: m.material_id || null,
          name: m.name,
          quantity: Number(m.quantity),
          unit_cost: Number(m.unit_cost),
          unit: m.unit || "unidad",
        }))
      );
    }
    if (values.labor.length > 0) {
      await supabase.from("product_labor").insert(
        values.labor.map((l) => ({
          product_id: savedId,
          work_type: l.work_type,
          hours: Number(l.hours),
          hourly_rate: Number(l.hourly_rate),
        }))
      );
    }
    
    const indirectsToInsert = [
      ...values.production_costs.map(ic => ({ ...ic, kind: 'production' })),
      ...values.other_costs.map(ic => ({ ...ic, kind: 'other' }))
    ];
    
    if (indirectsToInsert.length > 0) {
      await supabase.from("product_indirect_costs").insert(
        indirectsToInsert.map((ic) => ({
          product_id: savedId,
          concept: ic.concept,
          cost: Number(ic.cost),
          kind: ic.kind
        }))
      );
    }

    showToast(isNew ? labels.successNew : labels.successEdit);
    setSaving(false);
    router.push(basePath);
  };

  if (loading) {
    return (
      <div className="page-body">
        <div className="skeleton" style={{ height: 400, borderRadius: 14 }} />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={basePath} className="btn-icon">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1>{isNew ? labels.titleNew : labels.titleEdit}</h1>
            <p className="subtitle">{isNew ? labels.subtitleNew : form.getValues("code")}</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="content-grid">
            {/* Left Column — Form */}
            <div>
              <BasicInfoSection 
                register={form.register} 
                control={form.control} 
                categories={categories} 
                errors={form.formState.errors} 
                setValue={form.setValue}
                fixedType={type}
              />
              {form.watch("type") === "Servicio" && (
                <>
                  <MaterialsSection control={form.control} masterMaterials={masterMaterials} />
                  <LaborSection control={form.control} />
                  <IndirectCostsSection 
                    control={form.control} 
                    name="production_costs" 
                    title="🏭 Producción" 
                    buttonText="Agregar costo de producción" 
                  />
                  <IndirectCostsSection 
                    control={form.control} 
                    name="other_costs" 
                    title="📦 Otros" 
                    buttonText="Agregar otro costo" 
                  />
                </>
              )}
            </div>

            {/* Right Column — Cost Summary */}
            <div>
              <CostSummarySection watch={form.watch} saving={saving} isNew={isNew} />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
