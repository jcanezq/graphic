"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="page-body" style={{ maxWidth: 560, margin: "4rem auto", textAlign: "center" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Algo falló al cargar esta página</h1>
      <p className="subtitle" style={{ marginBottom: "1.5rem" }}>
        No pudimos completar la operación. Podés reintentar; si vuelve a pasar, avisanos.
      </p>
      {error.digest && (
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          Código de referencia: {error.digest}
        </p>
      )}
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button className="btn btn-primary" onClick={() => reset()}>
          Reintentar
        </button>
        <Link href="/dashboard" className="btn btn-secondary">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
