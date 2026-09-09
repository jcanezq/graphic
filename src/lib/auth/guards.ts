import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";

export type AuthContext = { user: User; isAdmin: boolean };

/**
 * Exige sesión válida. Devuelve el contexto o una NextResponse 401 ya armada.
 * Uso en un handler:
 *   const auth = await requireUser();
 *   if (auth instanceof NextResponse) return auth;
 *   const { user, isAdmin } = auth;
 */
export async function requireUser(): Promise<AuthContext | NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Debes iniciar sesión para realizar esta acción." },
      { status: 401 }
    );
  }

  return { user, isAdmin: isAdminEmail(user.email) };
}

/** Exige sesión válida Y privilegio de administrador. 401 si no hay sesión, 403 si no es admin. */
export async function requireAdmin(): Promise<AuthContext | NextResponse> {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  if (!auth.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  return auth;
}
