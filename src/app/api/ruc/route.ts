import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { rucQuerySchema } from '@/lib/validations/api';
import { rateLimit, clientKey } from '@/lib/rate-limit';

// El limitador en memoria exige runtime Node.js (default de las Route Handlers).
// No cambiar a 'edge': cada isolate tendría su propio contador.
export const runtime = 'nodejs';

const RUC_LIMIT = 20;              // consultas
const RUC_WINDOW_MS = 60 * 1000;   // por minuto y por usuario

export async function GET(request: Request) {
  // AUTORIZACIÓN: sesión requerida. Antes este endpoint era un proxy abierto al
  // servicio pagado de APISPERU y permitía enumerar razón social y dirección de
  // contribuyentes a cualquiera en Internet.
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const limit = rateLimit(clientKey(request, auth.user.id), RUC_LIMIT, RUC_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Demasiadas consultas de RUC. Espera un momento e intenta de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = rucQuerySchema.safeParse({
    ruc: (searchParams.get('numero') || searchParams.get('ruc') || '').trim(),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'El RUC debe tener 11 dígitos' }, { status: 400 });
  }
  const ruc = parsed.data.ruc;

  const token = process.env.APISPERU_TOKEN;
  if (!token) {
    console.error('[api/ruc] APISPERU_TOKEN no está configurado');
    return NextResponse.json({ error: 'Servicio de consulta no disponible.' }, { status: 503 });
  }

  try {
    // `ruc` ya está validado como 11 dígitos exactos: no hay inyección posible en el path.
    const url = `https://dniruc.apisperu.com/api/v1/ruc/${ruc}?token=${token}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'No se encontró información para este RUC' },
        { status: res.status === 404 ? 404 : 502 }
      );
    }

    const json = await res.json();

    if (json && json.razonSocial) {
      return NextResponse.json({
        razonSocial: json.razonSocial,
        estado: json.estado,
        condicion: json.condicion,
        direccion: json.direccion,
      });
    }

    return NextResponse.json({ error: 'El RUC no retornó datos válidos' }, { status: 404 });
  } catch (error) {
    console.error('[api/ruc] fallo al consultar el proveedor:', error);
    return NextResponse.json({ error: 'Error al consultar API de RUC' }, { status: 502 });
  }
}
