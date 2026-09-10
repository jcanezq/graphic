// Rate limiter en memoria del proceso. Sin dependencias y sin costo.
//
// LÍMITES REALES, para que nadie lo confunda con una garantía:
//  - El estado vive en la memoria de UNA instancia. Vercel puede tener varias:
//    el techo efectivo es (instancias x limit).
//  - Se pierde en cada arranque en frío.
//  - Requiere runtime Node.js. En Edge, cada isolate tendría su propio mapa.
// Alcanza para frenar el bucle de agotamiento de cuota, que es la amenaza de esta app.
// Upgrade natural: contador en el Postgres de Supabase (ver spec FASE 2).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5_000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now > existing.resetAt) {
    // Barrido perezoso para que el mapa no crezca sin control.
    if (buckets.size > MAX_TRACKED_KEYS) {
      for (const [k, v] of Array.from(buckets.entries())) {
        if (now > v.resetAt) buckets.delete(k);
      }
    }
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const ok = existing.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: ok ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Identidad para limitar: el usuario si hay sesión, la IP del proxy si no. */
export function clientKey(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || "ip-desconocida";
  return `ip:${ip}`;
}
