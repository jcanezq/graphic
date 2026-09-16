import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { generatePDF } from "@/lib/pdf-export";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;
    const { user, isAdmin } = auth;

    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      // Un id que no es UUID no puede existir: misma respuesta que "no encontrado".
      return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) {
      return NextResponse.json(
        { error: "El envío por correo todavía no está configurado." },
        { status: 503 }
      );
    }

    const supabase = createClient();

    // AUTORIZACIÓN: idéntica a /api/pdf/[id] — admin ve todo, el resto sólo lo
    // suyo, y el filtro va DENTRO de la consulta para que la fila ajena no llegue
    // nunca a memoria del proceso.
    let query = supabase
      .from("quotations")
      .select("*, items:quotation_items(*)")
      .order("sort_order", { referencedTable: "quotation_items", ascending: true })
      .eq("id", parsed.data.id);

    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    const { data: quotation, error: qError } = await query.single();
    if (qError || !quotation) {
      return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
    }

    // EL DESTINATARIO NO VIENE DEL CUERPO. Sale de la cotización, y la cotización
    // ya se comprobó que es de quien pide. Si el cuerpo pudiera elegir el `to`,
    // esta ruta sería un relé de correo abierto: cualquiera con una cuenta
    // mandaría correo a quien quisiera, firmado con el dominio de la empresa.
    const destino = (quotation.client_email || "").trim();
    if (!destino) {
      return NextResponse.json(
        { error: "Esta cotización no tiene un correo registrado." },
        { status: 400 }
      );
    }

    const { data: settings } = await supabase
      .from("company_settings")
      .select("*")
      .single();
    if (!settings) {
      return NextResponse.json({ error: "Falta la configuración de la empresa." }, { status: 500 });
    }

    const pdf = await generatePDF(quotation, settings);

    const resend = new Resend(apiKey);
    const { error: sendError } = await resend.emails.send({
      from,
      to: destino,
      subject: `Cotización ${quotation.number} — ${settings.company_name ?? "CotiGrafix"}`,
      text: [
        `Hola ${quotation.client_name},`,
        ``,
        `Adjuntamos la cotización ${quotation.number} por un total de S/ ${Number(quotation.total).toFixed(2)}.`,
        `Vigencia: ${quotation.validity_days} días.`,
        ``,
        `Los precios son referenciales y quedan sujetos a confirmación técnica.`,
        ``,
        `Gracias por escribirnos.`,
      ].join("\n"),
      attachments: [
        {
          filename: `${quotation.number}.pdf`,
          content: Buffer.from(pdf as ArrayBuffer),
        },
      ],
    });

    if (sendError) {
      console.error("[quotations/email] Resend rechazó el envío:", sendError);
      return NextResponse.json(
        { error: "No se pudo enviar el correo. Intentá de nuevo en unos minutos." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, to: destino });
  } catch (error: unknown) {
    console.error("Error enviando la cotización por correo:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
