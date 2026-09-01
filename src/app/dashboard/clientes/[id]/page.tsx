import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, User, Phone, Mail, MapPin, FileText } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatRelativeTime, getStatusLabel, getStatusColor } from "@/lib/formatters";
import type { Client, Quotation } from "@/types";

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: clientData, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !clientData) {
    notFound();
  }

  const client = clientData as Client;

  // Fetch quotes by matching client name (since there is no client_id in quotations yet)
  const { data: quotesData } = await supabase
    .from("quotations")
    .select("*")
    .eq("client_name", client.name)
    .order("created_at", { ascending: false });

  const quotes = (quotesData as Quotation[]) || [];

  // Calculate LTV (Lifetime Value) - Sum of all accepted quotes
  const ltv = quotes
    .filter((q) => q.status === "aceptada")
    .reduce((sum, q) => sum + Number(q.total), 0);

  // Stats
  const totalQuotes = quotes.length;
  const acceptedQuotes = quotes.filter((q) => q.status === "aceptada").length;
  const winRate = totalQuotes > 0 ? ((acceptedQuotes / totalQuotes) * 100).toFixed(0) : 0;

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/dashboard/clientes" className="btn-icon">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1>{client.name}</h1>
            <p className="subtitle">
              Cliente desde {new Date(client.created_at!).toLocaleDateString("es-PE", { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="content-grid" style={{ gridTemplateColumns: "1fr 2fr" }}>
          {/* Left Column - Contact Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
                Datos de Contacto
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <User size={18} style={{ color: "var(--text-muted)", marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>RUC</div>
                    <div>{client.ruc || "No especificado"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <Phone size={18} style={{ color: "var(--text-muted)", marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Teléfono</div>
                    <div>{client.phone || "No especificado"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <Mail size={18} style={{ color: "var(--text-muted)", marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Correo</div>
                    <div style={{ wordBreak: "break-all" }}>{client.email || "No especificado"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <MapPin size={18} style={{ color: "var(--text-muted)", marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Dirección</div>
                    <div>{client.address || "No especificada"}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="metric-card" style={{ padding: "var(--space-md)" }}>
              <div className="metric-label">LTV (Monto Aprobado)</div>
              <div className="metric-value" style={{ color: "var(--success)" }}>
                {formatCurrency(ltv)}
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "var(--space-md)" }}>
              <div className="metric-card" style={{ flex: 1, padding: "var(--space-md)" }}>
                <div className="metric-label">Cotizaciones</div>
                <div className="metric-value" style={{ fontSize: "1.2rem" }}>
                  {totalQuotes}
                </div>
              </div>
              <div className="metric-card" style={{ flex: 1, padding: "var(--space-md)" }}>
                <div className="metric-label">Win Rate</div>
                <div className="metric-value" style={{ fontSize: "1.2rem", color: "var(--accent)" }}>
                  {winRate}%
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Quotation History */}
          <div>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Historial de Cotizaciones</h3>
                <Link href="/dashboard/cotizaciones/nueva" className="btn btn-primary btn-sm">
                  Nueva Cotización
                </Link>
              </div>

              {quotes.length === 0 ? (
                <div className="empty-state" style={{ padding: "2rem" }}>
                  <FileText size={40} />
                  <h3>Sin cotizaciones</h3>
                  <p>Este cliente aún no tiene cotizaciones asociadas a su nombre.</p>
                </div>
              ) : (
                <div className="table-container" style={{ border: "none" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>N°</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((q) => (
                        <tr key={q.id}>
                          <td className="primary">
                            <Link href={`/dashboard/cotizaciones/${q.id}`} style={{ color: "var(--accent)" }}>
                              {q.number}
                            </Link>
                          </td>
                          <td style={{ fontWeight: 600 }}>{formatCurrency(Number(q.total))}</td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: `${getStatusColor(q.status)}20`,
                                color: getStatusColor(q.status),
                              }}
                            >
                              {getStatusLabel(q.status)}
                            </span>
                          </td>
                          <td>{formatRelativeTime(q.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
