import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-body" style={{ maxWidth: 560, margin: "4rem auto", textAlign: "center" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>No encontramos lo que buscabas</h1>
      <p className="subtitle" style={{ marginBottom: "1.5rem" }}>
        El recurso no existe o fue eliminado.
      </p>
      <Link href="/dashboard" className="btn btn-primary">
        Volver al inicio
      </Link>
    </div>
  );
}
