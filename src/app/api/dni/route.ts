import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { dniQuerySchema } from '@/lib/validations/api';
import { rateLimit, clientKey } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const DNI_LIMIT = 20;              // consultas
const DNI_WINDOW_MS = 60 * 1000;   // por minuto y por usuario

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const limit = rateLimit(clientKey(request, auth.user.id), DNI_LIMIT, DNI_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Demasiadas consultas de DNI. Espera un momento e intenta de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = dniQuerySchema.safeParse({
    dni: (searchParams.get('numero') || searchParams.get('dni') || '').trim(),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'El DNI debe tener 8 dígitos' }, { status: 400 });
  }
  const dni = parsed.data.dni;

  const token = process.env.APISPERU_TOKEN;
  if (!token) {
    console.error('[api/dni] APISPERU_TOKEN no está configurado');
    return NextResponse.json({ error: 'Servicio de consulta no disponible.' }, { status: 503 });
  }

  try {
    const url = `https://dniruc.apisperu.com/api/v1/dni/${dni}?token=${token}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'No se encontró información para este DNI' },
        { status: res.status === 404 ? 404 : 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[api/dni] Error:', error);
    return NextResponse.json({ error: 'Error al consultar la base de datos de RENIEC' }, { status: 500 });
  }
}
