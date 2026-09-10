import { NextResponse } from "next/server";
import { clientQuotationSchema } from "@/lib/validations/api";
import { serverError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import {
  createQuotationItemFromProduct,
  calcQuotationTotals,
  recalcQuotationItem,
} from "@/lib/calculations";
import { toQuotationItemRow } from "@/lib/quotation-item-row";
import { generateClientToAdminWhatsAppUrl } from "@/lib/whatsapp";
import type { Product } from "@/types";

export async function POST(request: Request) {
  try {
    // AUTORIZACIÓN: solo exige sesión. La cotización se crea SIEMPRE a nombre
    // del usuario autenticado (user_id abajo); el cuerpo no puede elegir dueño.
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
    }

    const parsed = clientQuotationSchema.safeParse(rawBody);
    if (!parsed.success) {
      // Solo el primer mensaje, y son mensajes propios: no se filtra la forma interna.
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: first?.message || "Datos de la cotización inválidos." },
        { status: 400 }
      );
    }

    const {
      client_name,
      client_phone,
      client_email,
      client_ruc,
      client_address,
      notes,
      items: rawItems,
    } = parsed.data;

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

      // Ya validado y acotado por clientQuotationItemSchema (1..MAX_QUANTITY_PER_ITEM).
      const qty = raw.quantity;
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
      // Sin fallback: una numeración sin lock produce duplicados que chocan
      // contra el UNIQUE de quotations.number y pierden la cotización.
      // El RPC generate_quotation_number es la única vía correcta.
      console.error("generate_quotation_number falló:", rpcError);
      return NextResponse.json(
        { error: "No se pudo generar el número de cotización. Reintentá en unos segundos." },
        { status: 503 }
      );
    }

    // 6. Alta de cliente en el CRM — SOLO alta, nunca actualización.
    //
    // Antes esto era un upsert por `name`, con el cliente admin (service role, sin RLS):
    // mandar el nombre de un cliente existente SOBREESCRIBÍA su teléfono, correo, RUC y
    // dirección con los del atacante, desviando las comunicaciones de la empresa.
    // `ignoreDuplicates` convierte la colisión en no-op: los datos de un cliente ya
    // registrado solo los cambia un administrador desde el panel.
    const resolvedEmail = client_email?.trim() || user.email || null;
    const { error: clientError } = await adminClient.from("clients").upsert(
      {
        name: client_name.trim(),
        ruc: client_ruc?.trim() || null,
        address: client_address?.trim() || null,
        phone: client_phone.trim(),
        email: resolvedEmail,
      },
      { onConflict: "name", ignoreDuplicates: true }
    );
    if (clientError) {
      // No es fatal: la cotización guarda su propio snapshot de client_* y es lo que vale.
      console.error("[client/quotations] no se pudo registrar el cliente:", clientError);
    }

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
      return serverError(
        "client/quotations:insert",
        insertError,
        "No se pudo guardar la cotización. Intenta nuevamente."
      );
    }

    // 8. Insert quotation items
    const { error: itemsError } = await adminClient.from("quotation_items").insert(
      quotationItems.map((item, idx) => toQuotationItemRow(item, idx, quotation.id))
    );

    if (itemsError) {
      await adminClient.from("quotations").delete().eq("id", quotation.id);
      return serverError(
        "client/quotations:items",
        itemsError,
        "No se pudo guardar el detalle de la cotización. Intenta nuevamente."
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
  } catch (error: unknown) {
    return serverError("client/quotations:unhandled", error);
  }
}
