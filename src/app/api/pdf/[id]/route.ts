import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { generatePDF } from "@/lib/pdf-export";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;
    const { user, isAdmin } = auth;

    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
      // Un id que no es UUID no puede existir: misma respuesta que "no encontrado",
      // para no dar señal distinta a un enumerador.
      return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
    }
    const quotationId = parsedParams.data.id;

    const supabase = createClient();

    // AUTORIZACIÓN: admin ve todo; cualquier otro, solo lo suyo.
    // El filtro va en la consulta (no en un if posterior) para que la fila ajena
    // no llegue nunca a memoria del proceso.
    let query = supabase
      .from("quotations")
      .select("*, items:quotation_items(*)")
      .order("sort_order", { referencedTable: "quotation_items", ascending: true })
      .eq("id", quotationId);

    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    const { data: quotation, error: qError } = await query.single();

    // 404 tanto si no existe como si es de otro: no se confirma la existencia del recurso.
    if (qError || !quotation) {
      return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
    }

    // La configuración de la empresa es el membrete del PDF —nombre, RUC, dirección,
    // teléfono, correo y logo—, no un dato del usuario. `company_settings` está
    // reservada al administrador porque guarda `default_margin`, así que con la
    // sesión del cliente esta consulta no devolvía NADA y la ruta contestaba 404:
    // el PDF del cliente no salía nunca.
    //
    // Se lee con el cliente administrador y SÓLO las seis columnas que el PDF usa.
    // `default_margin` no está en la lista y no puede salir de acá ni por error.
    const { data: settings, error: sError } = await createAdminClient()
      .from("company_settings")
      .select("company_name, ruc, address, phone, email, logo_url")
      .limit(1)
      .single();

    if (sError || !settings) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    }

    // Generate PDF (returns ArrayBuffer)
    const pdfBuffer = await generatePDF(quotation, settings);

    // Return the PDF as a Blob/Response
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quotation.number}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
