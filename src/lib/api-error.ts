import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * Loguea el error completo en el servidor y devuelve un mensaje genérico con un
 * identificador de correlación, para poder cruzar el reporte del usuario con el log
 * sin publicar el detalle del esquema.
 */
export function serverError(context: string, error: unknown, userMessage?: string) {
  const correlationId = randomUUID();
  console.error(`[${context}] ref=${correlationId}`, error);

  return NextResponse.json(
    {
      error: userMessage || "Ocurrió un error al procesar la solicitud. Intenta nuevamente.",
      ref: correlationId,
    },
    { status: 500 }
  );
}
