"use client";

import { useEffect, useState } from "react";
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

export default function ServiceFormPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
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
      type: "Servicio",
      category_id: "",
      description: "",
      unit: "unidad",
      useManualCost: false,
      manual_unit_cost: null,
      default_margin: 30,
      is_active: true,
      materials: [],
      labor: [],
      indirects: []
    }
  });

  useEffect(() => {
    fetchCategories();
    fetchMasterMaterials();
    if (productId) fetchProduct();
  }, [productId]);

  async function fetchMasterMaterials() {
    const { data } = await supabase.from("materials").select("*").order("name");
    // Also filter out deleted ones if soft deletes are used: .is("deleted_at", null)
    setMasterMaterials((data as Material[]) || []);
  }

  async function fetchCategories() {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setCategories((data as Category[]) || []);
  }

  async function fetchProduct() {
    const [prodRes, matRes, labRes, indRes] = await Promise.all([
      supabase.from("products").select("*").eq("id", productId).single(),
      supabase.from("product_materials").select("*").eq("product_id", productId),
      supabase.from("product_labor").select("*").eq("product_id", productId),
      supabase.from("product_indirect_costs").select("*").eq("product_id", productId),
    ]);

    if (prodRes.data) {
      const p = prodRes.data;
      form.reset({
        code: p.code || "",
        name: p.name || "",
        type: p.type || "Servicio",
        category_id: p.category_id || "",
        description: p.description || "",
        unit: p.unit || "unidad",
        manual_unit_cost: p.manual_unit_cost,
        useManualCost: p.manual_unit_cost != null,
        default_margin: Number(p.default_margin),
        is_active: p.is_active,
        materials: matRes.data || [],
        labor: labRes.data || [],
        indirects: indRes.data || []
      });
    }
    setLoading(false);
  }

  const onSubmit = async (values: ProductFormValues) => {
    setSaving(true);
    
    const productData = {
      code: values.code,
      name: values.name,
      type: values.type,
      category_id: values.category_id || null,
      description: values.description,
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
    if (values.indirects.length > 0) {
      await supabase.from("product_indirect_costs").insert(
        values.indirects.map((ic) => ({
          product_id: savedId,
          concept: ic.concept,
          cost: Number(ic.cost),
        }))
      );
    }

    showToast(isNew ? "Servicio creado exitosamente" : "Servicio actualizado");
    setSaving(false);
    router.push("/dashboard/servicios");
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
          <Link href="/dashboard/servicios" className="btn-icon">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1>{isNew ? "Nuevo Servicio" : "Editar Servicio"}</h1>
            <p className="subtitle">{isNew ? "Registra un nuevo servicio" : form.getValues("code")}</p>
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
                fixedType="Servicio"
              />
              <MaterialsSection control={form.control} masterMaterials={masterMaterials} />
              <LaborSection control={form.control} />
              <IndirectCostsSection control={form.control} />
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
