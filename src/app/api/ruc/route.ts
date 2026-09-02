import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ruc = searchParams.get('numero') || searchParams.get('ruc');

  if (!ruc || ruc.length !== 11) {
    return NextResponse.json({ error: 'El RUC debe tener 11 dígitos' }, { status: 400 });
  }

  try {
    const token = process.env.APISPERU_TOKEN;
    
    if (!token) {
      return NextResponse.json({ error: 'Token de API no configurado en el servidor' }, { status: 500 });
    }

    const url = `https://dniruc.apisperu.com/api/v1/ruc/${ruc}?token=${token}`;

    const res = await fetch(url, { 
      method: 'GET', 
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000) 
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'No se encontró información para este RUC' }, { status: res.status });
    }

    const json = await res.json();

    // Validar el formato de la respuesta de APISPERU
    if (json && json.razonSocial) {
      const data = {
        razonSocial: json.razonSocial,
        estado: json.estado,
        condicion: json.condicion,
        direccion: json.direccion
      };
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ error: 'El RUC no retornó datos válidos' }, { status: 404 });
    }

  } catch (error) {
    return NextResponse.json({ error: 'Error al consultar API de RUC' }, { status: 500 });
  }
}
