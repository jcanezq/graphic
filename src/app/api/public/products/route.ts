import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { calcUnitCost, calcUnitPrice, round2 } from "@/lib/calculations";
import type { PublicProduct } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Fetch company settings and categories
    const [settingsRes, categoriesRes, productsRes] = await Promise.all([
      supabase.from("company_settings").select("company_name, phone, igv_rate, logo_url").limit(1).single(),
      supabase.from("categories").select("id, name, slug, color").order("sort_order"),
      supabase.from("products").select("*").eq("is_active", true).order("name"),
    ]);

    const settings = settingsRes.data || {
      company_name: "CotiGrafix",
      phone: "",
      igv_rate: 0.18,
      logo_url: null,
    };

    const categories = categoriesRes.data || [];
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const products = productsRes.data || [];
    if (products.length === 0) {
      return NextResponse.json({
        products: [],
        categories,
        settings,
      });
    }

    const productIds = products.map((p) => p.id);

    // 2. Fetch cost components to securely calculate sale prices on the server
    const [matRes, labRes, indRes] = await Promise.all([
      supabase
        .from("product_materials")
        .select("product_id, quantity, unit_cost, materials(cost)")
        .in("product_id", productIds),
      supabase
        .from("product_labor")
        .select("product_id, hours, hourly_rate")
        .in("product_id", productIds),
      supabase
        .from("product_indirect_costs")
        .select("product_id, cost")
        .in("product_id", productIds),
    ]);

    const materialsData = matRes.data || [];
    const laborData = labRes.data || [];
    const indirectData = indRes.data || [];

    // 3. Compute public product representations — strict omission of internal costs & margins
    const publicProducts: PublicProduct[] = products.map((p) => {
      const pMaterials = materialsData
        .filter((m: any) => m.product_id === p.id)
        .map((m: any) => ({
          name: "",
          quantity: m.quantity,
          unit_cost: m.materials?.cost ?? m.unit_cost,
        }));

      const pLabor = laborData.filter((l: any) => l.product_id === p.id);
      const pIndirect = indirectData.filter((i: any) => i.product_id === p.id);

      const unitCost = calcUnitCost({
        manual_unit_cost: p.manual_unit_cost,
        materials: pMaterials as any,
        labor: pLabor as any,
        indirect_costs: pIndirect as any,
      });

      const margin = p.default_margin ?? 30;
      const unitPrice = round2(calcUnitPrice(unitCost, margin));
      
      // Calculate components with margin for public display
      const laborCost = pLabor.reduce((acc, l) => acc + (l.hours * l.hourly_rate), 0);
      const laborPrice = round2(calcUnitPrice(laborCost, margin));
      
      const designCostItem = pIndirect.find((ic: any) => ic.concept?.toLowerCase().includes('diseño') || ic.concept?.toLowerCase().includes('design'));
      const designCost = designCostItem ? designCostItem.cost : 0;
      const designPrice = round2(calcUnitPrice(designCost, margin));

      const materialCost = pMaterials.reduce((acc, m) => acc + (m.quantity * m.unit_cost), 0);
      const materialPrice = round2(calcUnitPrice(materialCost, margin));

      const otherCost = pIndirect.reduce((acc, i) => acc + i.cost, 0) - designCost;
      const otherPrice = round2(calcUnitPrice(otherCost, margin));

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        type: p.type as any,
        unit: p.unit as any,
        description: p.description || "",
        image_url: p.image_url,
        category_id: p.category_id,
        category_name: p.category_id ? categoryMap.get(p.category_id) || null : null,
        unit_price: unitPrice > 0 ? unitPrice : 1.0,
        labor_price: laborPrice,
        design_price: designPrice,
        material_price: materialPrice,
        other_price: otherPrice,
      };
    });

    return NextResponse.json({
      products: publicProducts,
      categories,
      settings,
    });
  } catch (error: any) {
    console.error("[public/products error]:", error);
    return NextResponse.json(
      { error: "Error al cargar el catálogo público" },
      { status: 500 }
    );
  }
}
