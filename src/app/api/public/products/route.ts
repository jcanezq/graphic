import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { calcUnitPrice, round2, findIndirectByKind } from "@/lib/calculations";
import { COMPONENT_SCOPE_DEFAULTS } from "@/lib/pricing";
import type { PublicProduct } from "@/types";

// PÚBLICO DELIBERADO: este endpoint sirve el catálogo a visitantes sin sesión.
//
// CONTRATO: la respuesta expone SOLO precios de venta (costo x margen) y datos
// descriptivos. Prohibido agregar `manual_unit_cost`, `default_margin`, `cost`,
// `unit_cost`, `hourly_rate` ni ningún campo de proveedor: el margen de la empresa
// no sale de acá. El mapeo de más abajo es una whitelist; mantenerla así.
//
// OJO: este handler NO es el único camino a los datos. La política
// `public_read_products` (supabase/migrations/allow_public_read_catalog.sql) permite
// al rol anónimo leer products.* directo por REST, márgenes incluidos. Cerrar eso
// es trabajo de la lane SQL (hallazgo A-3): este comentario no lo resuelve.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Fetch company settings and categories
    const [settingsRes, categoriesRes, productsRes, materialsRes] = await Promise.all([
      supabase.from("company_settings").select("company_name, phone, igv_rate, logo_url").limit(1).single(),
      supabase.from("categories").select("id, name, slug, color").order("sort_order"),
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("materials").select("*").is("deleted_at", null).order("name"),
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
    const rawMaterials = materialsRes.data || [];

    if (products.length === 0 && rawMaterials.length === 0) {
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
        .select("product_id, quantity, unit_cost, material_ref:products!product_materials_material_id_fkey(manual_unit_cost)")
        .in("product_id", productIds),
      supabase
        .from("product_labor")
        .select("product_id, hours, hourly_rate")
        .in("product_id", productIds),
      supabase
        .from("product_indirect_costs")
        .select("*")
        .in("product_id", productIds),
    ]);

    const materialsData = matRes.data || [];
    const laborData = labRes.data || [];
    const indirectData = indRes.data || [];

    // Map raw materials as public products
    const mappedMaterials = rawMaterials.map((m: any) => ({
      id: m.id,
      code: `MAT`,
      name: m.name,
      type: "Material",
      unit: m.unit,
      description: "",
      image_url: null,
      category_id: null,
      manual_unit_cost: m.cost,
      default_margin: 30, // Or settings default margin if available
    }));

    const allProducts = [...products, ...mappedMaterials];

    // 3. Compute public product representations — strict omission of internal costs & margins
    const publicProducts: PublicProduct[] = allProducts.map((p) => {
      const pMaterials = materialsData
        .filter((m: any) => m.product_id === p.id)
        .map((m: any) => ({
          name: "",
          quantity: m.quantity,
          unit_cost: m.material_ref?.manual_unit_cost ?? m.unit_cost,
        }));

      const pLabor = laborData.filter((l: any) => l.product_id === p.id);
      const pIndirect = indirectData.filter((i: any) => i.product_id === p.id);

      // Precio BASE: material + indirectos que NO son diseño ni transporte.
      // La mano de obra, el diseño y el transporte se publican aparte, cada uno
      // con su scope, para que el carrito escale igual que el servidor (C-1).
      const margin = p.default_margin ?? 30;
      const materialCostRaw = pMaterials.reduce((acc: number, m: any) => acc + (m.quantity * m.unit_cost), 0);
      const laborCostRaw = pLabor.reduce((acc: number, l: any) => acc + (l.hours * l.hourly_rate), 0);
      const designCostItem = findIndirectByKind(pIndirect as any, 'design');
      const designCostRaw = designCostItem ? ((designCostItem as any).quantity != null && (designCostItem as any).unit_cost != null ? Number((designCostItem as any).quantity) * Number((designCostItem as any).unit_cost) : Number(designCostItem.cost || 0)) : 0;
      
      const transportCostItem = findIndirectByKind(pIndirect as any, 'transport');
      const transportCostRaw = transportCostItem ? ((transportCostItem as any).quantity != null && (transportCostItem as any).unit_cost != null ? Number((transportCostItem as any).quantity) * Number((transportCostItem as any).unit_cost) : Number(transportCostItem.cost || 0)) : 0;
      
      const totalIndirectRaw = pIndirect.reduce((acc: number, i: any) => {
        const cost = (i.quantity != null && i.unit_cost != null) 
          ? Number(i.quantity) * Number(i.unit_cost) 
          : Number(i.cost || 0);
        return acc + cost;
      }, 0);
      const otherIndirectRaw = totalIndirectRaw - designCostRaw - transportCostRaw;

      const baseCost = (p.manual_unit_cost != null && p.manual_unit_cost > 0)
        ? p.manual_unit_cost
        : (materialCostRaw + otherIndirectRaw);
      const baseUnitPrice = round2(calcUnitPrice(baseCost, margin));

      // `unit_price` se conserva por compatibilidad de la vista de catálogo:
      // es el precio de UNA unidad con sus componentes, o sea el total de cantidad 1.
      const unitPrice = round2(
        baseUnitPrice
        + round2(calcUnitPrice(laborCostRaw, margin))
        + round2(calcUnitPrice(designCostRaw, margin))
        + round2(calcUnitPrice(transportCostRaw, margin))
      );
      
      // Calculate components with margin for public display
      const laborPrice = round2(calcUnitPrice(laborCostRaw, margin));
      const designPrice = round2(calcUnitPrice(designCostRaw, margin));
      const transportPrice = round2(calcUnitPrice(transportCostRaw, margin));
      const materialPrice = round2(calcUnitPrice(materialCostRaw, margin));
      const otherPrice = round2(calcUnitPrice(otherIndirectRaw, margin));

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
        unit_price: unitPrice,
        base_unit_price: baseUnitPrice,
        labor_price: laborPrice,
        design_price: designPrice,
        transport_price: transportPrice,
        material_price: materialPrice,
        other_price: otherPrice,
        labor_scope: COMPONENT_SCOPE_DEFAULTS.labor,
        design_scope: COMPONENT_SCOPE_DEFAULTS.design,
        transport_scope: COMPONENT_SCOPE_DEFAULTS.transport,
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
