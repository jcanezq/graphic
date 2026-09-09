import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";

// Devuelve ÚNICAMENTE el estado del propio llamador. No enumera administradores
// ni acepta parámetros: no hay superficie para preguntar por otro usuario.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) {
    return NextResponse.json({ authenticated: false, isAdmin: false }, { status: 200 });
  }

  return NextResponse.json(
    { authenticated: true, isAdmin: auth.isAdmin, email: auth.user.email ?? null },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
