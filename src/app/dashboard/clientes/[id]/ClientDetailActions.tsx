"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { ArrowLeft, User, Phone, Mail, MapPin, FileText, Edit2, Save, X, StickyNote, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, formatRelativeTime, getStatusLabel, getStatusColor } from "@/lib/formatters";
import type { Client } from "@/types";

interface QuoteSummary {
  id: string;
  number: string;
  total: number;
  status: string;
  created_at: string;
}

interface StatusDist {
  status: string;
  count: number;
  total: number;
}

interface Props {
  client: Client;
  quotes: QuoteSummary[];
  ltv: number;
  totalAmount: number;
  totalQuotes: number;
  winRate: number;
  statusDist: StatusDist[];
}

export default function ClientDetailActions({ client, quotes, ltv, totalAmount, totalQuotes, winRate, statusDist }: Props) {
  const supabase = createClient();
  const { showToast } = useToast();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState(client.name);
  const [ruc, setRuc] = useState(client.ruc || "");
  const [phone, setPhone] = useState(client.phone || "");
  const [email, setEmail] = useState(client.email || "");
  const [address, setAddress] = useState(client.address || "");
  const [notes, setNotes] = useState(client.notes || "");

  async function handleSave() {
    if (!name.trim()) {
      showToast("El nombre es obligatorio", "error");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({
        name: name.trim(),
        ruc: ruc || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id);

    if (error) {
      showToast("Error al guardar: " + error.message, "error");
    } else {
      showToast("Cliente actualizado");
      setEditing(false);
      router.refresh();
    }
    setSaving(false);
  }

  function handleCancel() {
    setName(client.name);
    setRuc(client.ruc || "");
    setPhone(client.phone || "");
    setEmail(client.email || "");
    setAddress(client.address || "");
    setNotes(client.notes || "");
    setEditing(false);
  }

  // Build pre-filled query string for new quotation
  const newQuotParams = new URLSearchParams({
    client_name: client.name,
    ...(client.ruc ? { client_ruc: client.ruc } : {}),
    ...(client.address ? { client_address: client.address } : {}),
    ...(client.phone ? { client_phone: client.phone } : {}),
    ...(client.email ? { client_email: client.email } : {}),
  }).toString();

  const maxStatusCount = Math.max(...statusDist.map(s => s.count), 1);

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
        <div className="page-header-actions">
          {!editing ? (
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>
              <Edit2 size={16} /> Editar
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" onClick={handleCancel} disabled={saving}>
                <X size={16} /> Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={16} /> {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          )}
          <Link href={`/dashboard/cotizaciones/nueva?${newQuotParams}`} className="btn btn-primary">
            <Plus size={16} /> Nueva Cotización
          </Link>
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
                {/* RUC */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <User size={18} style={{ color: "var(--text-muted)", marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>RUC</div>
                    {editing ? (
                      <input 
                        value={ruc} 
                        onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))} 
                        maxLength={11}
                        placeholder="20123456789" 
                        style={{ width: "100%", marginTop: 4 }} 
                      />
                    ) : (
                      <div>{client.ruc || "No especificado"}</div>
                    )}
                  </div>
                </div>
                {/* Teléfono */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <Phone size={18} style={{ color: "var(--text-muted)", marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Teléfono</div>
                    {editing ? (
                      <input 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)} 
                        placeholder="999 888 777" 
                        style={{ width: "100%", marginTop: 4 }} 
                      />
                    ) : (
                      <div>{client.phone || "No especificado"}</div>
                    )}
                  </div>
                </div>
                {/* Correo */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <Mail size={18} style={{ color: "var(--text-muted)", marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Correo</div>
                    {editing ? (
                      <input 
                        type="email"
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="ejemplo@correo.com" 
                        style={{ width: "100%", marginTop: 4 }} 
                      />
                    ) : (
                      <div style={{ wordBreak: "break-all" }}>{client.email || "No especificado"}</div>
                    )}
                  </div>
                </div>
                {/* Dirección */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <MapPin size={18} style={{ color: "var(--text-muted)", marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Dirección</div>
                    {editing ? (
                      <input 
                        value={address} 
                        onChange={(e) => setAddress(e.target.value)} 
                        placeholder="Av. Principal 123" 
                        style={{ width: "100%", marginTop: 4 }} 
                      />
                    ) : (
                      <div>{client.address || "No especificada"}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Notas internas */}
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: 8 }}>
                <StickyNote size={16} /> Notas Internas
              </h3>
              {editing ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas internas sobre este cliente (no visibles en cotizaciones)..."
                  rows={4}
                  style={{ width: "100%", resize: "vertical" }}
                />
              ) : (
                <div style={{ 
                  fontSize: "0.88rem", color: notes ? "var(--text-primary)" : "var(--text-muted)",
                  whiteSpace: "pre-wrap", lineHeight: 1.6,
                  padding: notes ? 0 : "12px",
                  background: notes ? "transparent" : "var(--bg-tertiary)",
                  borderRadius: "var(--radius-md)",
                  textAlign: notes ? "left" : "center",
                }}>
                  {notes || "Sin notas. Haz clic en \"Editar\" para agregar notas internas."}
                </div>
              )}
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

            {/* Status Distribution Mini Chart */}
            {totalQuotes > 0 && (
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: "var(--space-sm)" }}>
                  Distribución por Estado
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {statusDist.filter(s => s.count > 0).map(s => (
                    <div key={s.status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 70, fontSize: "0.75rem", fontWeight: 600, color: getStatusColor(s.status) }}>
                        {getStatusLabel(s.status)}
                      </div>
                      <div style={{ flex: 1, height: 20, background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${(s.count / maxStatusCount) * 100}%`,
                          background: `${getStatusColor(s.status)}30`,
                          borderLeft: `3px solid ${getStatusColor(s.status)}`,
                          borderRadius: "var(--radius-sm)",
                          transition: "width 0.5s ease",
                          minWidth: 4,
                        }} />
                      </div>
                      <div style={{ width: 24, textAlign: "right", fontSize: "0.78rem", fontWeight: 700 }}>
                        {s.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Quotation History */}
          <div>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Historial de Cotizaciones</h3>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Monto total: <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(totalAmount)}</strong>
                  </span>
                  <Link href={`/dashboard/cotizaciones/nueva?${newQuotParams}`} className="btn btn-primary btn-sm">
                    <Plus size={14} /> Nueva
                  </Link>
                </div>
              </div>

              {quotes.length === 0 ? (
                <div className="empty-state" style={{ padding: "2rem" }}>
                  <FileText size={40} />
                  <h3>Sin cotizaciones</h3>
                  <p>Este cliente aún no tiene cotizaciones asociadas.</p>
                  <Link href={`/dashboard/cotizaciones/nueva?${newQuotParams}`} className="btn btn-primary">
                    <Plus size={16} /> Crear Primera Cotización
                  </Link>
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
                          <td style={{ fontWeight: 600 }}>{formatCurrency(q.total)}</td>
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
