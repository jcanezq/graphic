import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Los datos públicos de la empresa: los mismos cuatro campos que
// /api/public/products ya le entrega a cualquier visitante anónimo
// (`public/products/route.ts:25`). No se agrega superficie nueva; lo que se
// agrega es poder pedirlos SIN arrastrar el catálogo entero.
//
// `default_margin` NO está en el select y no puede salir de acá.
//
// `force-dynamic` NO es decorativo, y es la misma razón por la que lo declara
// /api/public/products: sin esto Next evalúa el handler DURANTE el build, llama a
// createAdminClient() y revienta donde no existe SUPABASE_SERVICE_ROLE_KEY —que es
// justamente el CI, donde esa clave no debe existir—. En una máquina con .env.local
// el build pasa y el defecto no se ve.
export const dynamic = "force-dynamic";

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
