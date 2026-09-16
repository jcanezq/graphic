import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Los datos públicos de la empresa: los mismos cuatro campos que
// /api/public/products ya le entrega a cualquier visitante anónimo
// (`public/products/route.ts:25`). No se agrega superficie nueva; lo que se
// agrega es poder pedirlos SIN arrastrar el catálogo entero.
//
// `default_margin` NO está en el select y no puede salir de acá.
export async function GET() {
  const { data } = await createAdminClient()
    .from("company_settings")
    .select("company_name, phone, igv_rate, logo_url")
    .limit(1)
    .single();

  return NextResponse.json(
    data ?? { company_name: "CotiGrafix", phone: null, igv_rate: 0.18, logo_url: null }
  );
}
