import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// `force-dynamic` NO es decorativo: sin esto Next evalúa el handler DURANTE el
// build, llama a createAdminClient() y revienta donde no existe
// SUPABASE_SERVICE_ROLE_KEY —el CI—. Y donde sí existe, congela la respuesta en
// la compilación: cambiar un banner no cambiaría nada hasta el próximo
// despliegue. Ver docs/ARQUITECTURA.md §7.14.
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await createAdminClient()
    .from("home_banners")
    .select("id, image_url, alt_text, link_url, title, subtitle, cta_label")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    // La portada NO se cae por esto: se devuelve lista vacía y el carrusel
    // simplemente no aparece. Pero tiene que quedar rastro. Este mismo silencio
    // ya escondió una migración sin aplicar, y desde afuera se veía igual que
    // «todavía no hay banners».
    console.error("[public/banners] no se pudieron leer los banners:", error);
  }

  return NextResponse.json({ banners: data ?? [] });
}
