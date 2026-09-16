import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

// GET /api/art?path=<ruta en client-art>  ->  302 a una URL firmada de vida corta.
//
// El 404 es el mismo para «no existe» y «no es tuyo»: no se confirma la
// existencia de un archivo ajeno. Mismo criterio que /api/pdf/[id].
const TTL_SEGUNDOS = 300;

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const path = request.nextUrl.searchParams.get("path") ?? "";

  // Una ruta vieja (URL pública heredada) no se sirve: el bucket está cerrado.
  if (!path || path.startsWith("http")) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  // La propiedad vive en la ruta: '<uid>/<archivo>'. Es la misma regla que
  // aplican las políticas de storage, replicada acá para no filtrar por rebote.
  const duenio = path.split("/")[0];
  if (duenio !== auth.user.id && !auth.isAdmin) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("client-art")
    .createSignedUrl(path, TTL_SEGUNDOS);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
