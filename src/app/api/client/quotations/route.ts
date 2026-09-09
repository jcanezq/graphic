import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  createQuotationItemFromProduct,
  calcQuotationTotals,
  recalcQuotationItem,
} from "@/lib/calculations";
import { generateClientToAdminWhatsAppUrl } from "@/lib/whatsapp";
import type { Product } from "@/types";

export async function POST(request: Request) {
  try {
    const userClient = createClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para generar la cotización." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      client_name,
      client_phone,
      client_email,
      client_ruc,
      client_address,
      notes,
      items: rawItems,
    } = body;

    if (!client_name || !client_name.trim()) {
      return NextResponse.json(
        { error: "El nombre o razón social es obligatorio." },
        { status: 400 }
      );
    }

    if (!client_phone || !client_phone.trim()) {
      return NextResponse.json(
        { error: "El número de teléfono o WhatsApp es obligatorio para confirmar tu cotización." },
        { status: 400 }
      );
    }

    if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { error: "Debes incluir al menos un producto o servicio en tu cotización." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 1. Fetch company settings
    const { data: settings } = await adminClient
      .from("company_settings")
      .select("*")
      .limit(1)
      .single();

    const igvRate = settings?.igv_rate ?? 0.18;
    const adminPhone = settings?.phone || "";

    // 2. Fetch full product details for requested items
    const productIds = rawItems.map((it: any) => it.product_id).filter(Boolean);
    const { data: productsData } = await adminClient
      .from("products")
      .select("*")
      .in("id", productIds)
      .eq("is_active", true);

    if (!productsData || productsData.length === 0) {
      return NextResponse.json(
        { error: "Los productos seleccionados no se encuentran disponibles." },
        { status: 400 }
      );
    }

    // Fetch materials, labor, indirect costs to calculate true snapshot
    const [matRes, labRes, indRes] = await Promise.all([
      adminClient
        .from("product_materials")
        .select("*, materials(id, cost, name, unit)")
        .in("product_id", productIds),
      adminClient
        .from("product_labor")
        .select("*")
        .in("product_id", productIds),
      adminClient
        .from("product_indirect_costs")
        .select("*")
        .in("product_id", productIds),
    ]);

    const fullProducts: Product[] = productsData.map((p: any) => {
      const materials = (matRes.data || [])
        .filter((m: any) => m.product_id === p.id)
        .map((m: any) => ({
          ...m,
          unit_cost: m.materials?.cost ?? m.unit_cost,
          name: m.materials?.name ?? m.name,
          unit: m.materials?.unit ?? m.unit,
        }));
      return {
        ...p,
        materials,
        labor: (labRes.data || []).filter((l: any) => l.product_id === p.id),
        indirect_costs: (indRes.data || []).filter((ic: any) => ic.product_id === p.id),
      };
    });

    const productMap = new Map(fullProducts.map((p) => [p.id, p]));

    // 3. Build snapshot items
    const quotationItems: any[] = [];
    for (let i = 0; i < rawItems.length; i++) {
      const raw = rawItems[i];
      const prod = productMap.get(raw.product_id);
      if (!prod) continue;

      const qty = Math.max(1, Number(raw.quantity) || 1);
      const margin = settings?.default_margin ?? prod.default_margin ?? 30;
      let snapItem = createQuotationItemFromProduct(prod, qty, margin, i);
      
      snapItem = recalcQuotationItem(snapItem, {
        has_labor: raw.has_labor ?? true,
        has_design: raw.has_design ?? true,
        has_transport: raw.has_transport ?? true,
      });
      
      quotationItems.push(snapItem);
    }

    if (quotationItems.length === 0) {
      return NextResponse.json(
        { error: "No se pudieron procesar los ítems de la cotización." },
        { status: 400 }
      );
    }

    // 4. Calculate totals
    const totals = calcQuotationTotals(quotationItems, igvRate);

    // 5. Generate quotation number
    let number: string | null = null;
    const { data: rpcNumber, error: rpcError } = await adminClient.rpc("generate_quotation_number");
    if (!rpcError && rpcNumber) {
      number = rpcNumber;
    } else {
      const prefix = settings?.quotation_prefix || "COT";
      const nextNum = settings?.quotation_next_number || 1;
      const year = new Date().getFullYear();
      number = `${prefix}-${year}-${String(nextNum).padStart(4, "0")}`;

      if (settings?.id) {
        await adminClient
          .from("company_settings")
          .update({ quotation_next_number: nextNum + 1 })
          .eq("id", settings.id);
      }
    }

    // 6. Upsert client record
    const resolvedEmail = client_email?.trim() || user.email || null;
    await adminClient.from("clients").upsert(
      {
        name: client_name.trim(),
        ruc: client_ruc?.trim() || null,
        address: client_address?.trim() || null,
        phone: client_phone.trim(),
        email: resolvedEmail,
      },
      { onConflict: "name" }
    );

    // 7. Insert quotation into database
    // We try 'solicitada', if DB check constraint fails, fall back to 'borrador'
    const fullNotes = `[Solicitud Web de Cliente - Precios sujetos a confirmación] ${notes ? `Notas: ${notes}` : ""}`.trim();

    let insertPayload: any = {
      number,
      user_id: user.id,
      client_name: client_name.trim(),
      client_ruc: client_ruc?.trim() || null,
      client_address: client_address?.trim() || null,
      client_phone: client_phone.trim(),
      client_email: resolvedEmail,
      subtotal: totals.subtotal,
      igv_rate: igvRate,
      igv: totals.igv,
      total: totals.total,
      notes: fullNotes,
      validity_days: 15,
      status: "solicitada",
    };

    let { data: quotation, error: insertError } = await adminClient
      .from("quotations")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError && insertError.message.includes("quotations_status_check")) {
      // Fallback for when migration hasn't been executed in database
      insertPayload.status = "borrador";
      const retry = await adminClient
        .from("quotations")
        .insert(insertPayload)
        .select()
        .single();
      quotation = retry.data;
      insertError = retry.error;
    }

    if (insertError || !quotation) {
      console.error("Error creating quotation:", insertError);
      return NextResponse.json(
        { error: "Error al guardar la cotización: " + (insertError?.message || "Desconocido") },
        { status: 500 }
      );
    }

    // 8. Insert quotation items
    const { error: itemsError } = await adminClient.from("quotation_items").insert(
      quotationItems.map((item, idx) => ({
        quotation_id: quotation.id,
        product_id: item.product_id || null,
        item_type: item.item_type || null,
        sort_order: idx,
        product_code: item.product_code,
        product_name: item.product_name,
        product_description: item.product_description,
        unit: item.unit,
        material_cost: item.material_cost,
        labor_cost: item.labor_cost,
        indirect_cost: item.indirect_cost,
        unit_cost: item.unit_cost,
        quantity: item.quantity,
        margin_percent: item.margin_percent,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        has_labor: item.has_labor,
        has_design: item.has_design,
        has_transport: item.has_transport,
        design_cost: item.design_cost,
        transport_cost: item.transport_cost,
      }))
    );

    if (itemsError) {
      await adminClient.from("quotations").delete().eq("id", quotation.id);
      return NextResponse.json(
        { error: "Error guardando los ítems de la cotización: " + itemsError.message },
        { status: 500 }
      );
    }

    // 9. Generate WhatsApp confirmation URL
    const whatsappUrl = generateClientToAdminWhatsAppUrl({
      adminPhone,
      quotationNumber: number!,
      clientName: client_name.trim(),
      total: totals.total,
      items: quotationItems.map((it) => ({
        name: it.product_name,
        quantity: it.quantity,
        unit: it.unit,
        subtotal: it.subtotal,
      })),
    });

    return NextResponse.json({
      success: true,
      quotationId: quotation.id,
      number,
      total: totals.total,
      whatsappUrl,
    });
  } catch (error: any) {
    console.error("[client/quotations error]:", error);
    return NextResponse.json(
      { error: "Error interno al procesar la cotización: " + error.message },
      { status: 500 }
    );
  }
}
