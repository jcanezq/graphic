// Resolución de privilegio de administrador. Fail-CLOSED por diseño:
// sin ADMIN_EMAILS configurada, NADIE es admin.
//
// Este módulo NO debe importar nada de next/headers ni de @/lib/supabase/server:
// lo importa src/middleware.ts, que corre en el runtime Edge.

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  const allowed = getAdminEmails();
  // Fail-closed: falta de configuración == cero privilegios.
  if (allowed.length === 0) return false;

  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return false;

  return allowed.includes(normalized);
}
