import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Las variables NEXT_PUBLIC_* se inlinean en tiempo de build: si faltan acá,
  // faltan en el entorno de build y la app desplegada no va a funcionar. El stub
  // anterior (placeholder.supabase.co) escondía eso y lo convertía en errores de
  // autenticación incomprensibles en producción.
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY son obligatorias. " +
        "Definirlas en el entorno de build y de ejecución."
    );
  }

  return createBrowserClient(url, key);
}
