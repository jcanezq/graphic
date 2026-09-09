import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Ignored when called from a Server Component
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Ignored when called from a Server Component
          }
        },
      },
    }
  );
}

// Admin client with service role privileges.
// ONLY use in API routes / server actions, never on the client.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  // Antes había un fallback a la anon key. Era un fallo silencioso: la función
  // seguía llamándose createAdminClient, devolvía un cliente sin privilegios y el
  // catálogo público terminaba publicando productos a S/ 1.00 por el fallback de
  // precio. Un error ruidoso en el arranque es infinitamente más barato que eso.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no está configurada: createAdminClient() no puede operar. " +
        "Definirla en el entorno del servidor (nunca como NEXT_PUBLIC_)."
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no está configurada.");
  }

  return createSupabaseClient(
    url,
    serviceKey,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url, opts = {}) =>
          fetch(url, { ...opts, cache: "no-store" }),
      },
    }
  );
}
