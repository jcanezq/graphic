"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { generateClientToAdminWhatsAppUrl } from "@/lib/whatsapp";
import type { Quotation } from "@/types";
import {
  FileText,
  MessageCircle,
  Clock,
  Plus,
  ArrowRight,
  ShieldAlert,
  LogIn,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function MisCotizacionesPage() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [companyPhone, setCompanyPhone] = useState<string>("");

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        // Fetch company phone
        const { data: settings } = await supabase
          .from("company_settings")
          .select("phone")
          .limit(1)
          .single();
        if (settings?.phone) setCompanyPhone(settings.phone);

        if (user) {
          const { data, error } = await supabase
            .from("quotations")
            .select("*, quotation_items(*)")
            .order("sort_order", { referencedTable: "quotation_items", ascending: true })
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false });

          if (!error && data) {
            setQuotations(data);
          }
        }
      } catch (err) {
        console.error("Error loading client quotations:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [supabase]);

  function getStatusBadge(status: string) {
    switch (status) {
      case "solicitada":
        return {
          label: "Solicitada · Por Confirmar",
          bg: "rgba(245, 158, 11, 0.12)",
          color: "#d97706",
          border: "1px solid rgba(245, 158, 11, 0.3)",
        };
      case "borrador":
        return {
          label: "En Revisión Técnica",
          bg: "rgba(59, 130, 246, 0.1)",
          color: "#2563eb",
          border: "1px solid rgba(59, 130, 246, 0.25)",
        };
      case "enviada":
        return {
          label: "Cotización Confirmada",
          bg: "rgba(79, 70, 229, 0.1)",
          color: "#4f46e5",
          border: "1px solid rgba(79, 70, 229, 0.25)",
        };
      case "aceptada":
        return {
          label: "Aprobada · En Producción",
          bg: "rgba(16, 185, 129, 0.12)",
          color: "#059669",
          border: "1px solid rgba(16, 185, 129, 0.3)",
        };
      case "rechazada":
        return {
          label: "Rechazada",
          bg: "rgba(239, 68, 68, 0.1)",
          color: "#dc2626",
          border: "1px solid rgba(239, 68, 68, 0.25)",
        };
      default:
        return {
          label: status,
          bg: "var(--bg-tertiary)",
          color: "var(--text-secondary)",
          border: "1px solid var(--surface-border)",
        };
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
      <PublicNavbar />

      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "3rem 1.5rem", width: "100%", flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Mis Cotizaciones
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", marginTop: "0.2rem" }}>
              Consulta el estado de tus solicitudes y coordina directamente con tu asesor por WhatsApp.
            </p>
          </div>

          <Link
            href="/cotizar"
            prefetch={false}
            className="btn btn-primary"
            style={{
              padding: "0.65rem 1.25rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              borderRadius: "var(--radius-md)",
            }}
          >
            <Plus size={16} />
            <span>Nueva Cotización</span>
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 0" }}>
            <div
              style={{
                width: 44,
                height: 44,
                margin: "0 auto 1rem auto",
                border: "3px solid rgba(79, 70, 229, 0.2)",
                borderTop: "3px solid var(--accent)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Cargando tus cotizaciones...</p>
          </div>
        ) : !user ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 2rem",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--surface-border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "var(--accent-light)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem auto",
              }}
            >
              <LogIn size={28} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              Inicia sesión para ver tus cotizaciones
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", maxWidth: "440px", margin: "0 auto 1.5rem auto" }}>
              Accede con tu cuenta de Google para consultar el historial de presupuestos que has generado.
            </p>
            <Link
              href="/login?redirect=/mis-cotizaciones"
              prefetch={false}
              className="btn btn-primary"
              style={{ padding: "0.75rem 1.5rem", fontSize: "0.95rem", fontWeight: 600 }}
            >
              Iniciar Sesión
            </Link>
          </div>
        ) : quotations.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 2rem",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-xl)",
              border: "1px dashed var(--surface-border)",
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "var(--bg-tertiary)",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem auto",
              }}
            >
              <FileText size={28} />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
              Aún no tienes cotizaciones registradas
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: "420px", margin: "0 auto 1.5rem auto" }}>
              Puedes armar tu presupuesto en cualquier momento desde nuestro cotizador en línea.
            </p>
            <Link
              href="/cotizar"
              prefetch={false}
              className="btn btn-primary"
              style={{ padding: "0.75rem 1.5rem", fontSize: "0.95rem", fontWeight: 600 }}
            >
              Crear mi primera cotización
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {quotations.map((q) => {
              const badge = getStatusBadge(q.status);
              const waUrl = generateClientToAdminWhatsAppUrl({
                adminPhone: companyPhone,
                quotationNumber: q.number,
                clientName: q.client_name,
                total: q.total,
                items: (q.quotation_items || []).map((it: any) => ({
                  name: it.product_name,
                  quantity: it.quantity,
                  unit: it.unit,
                  subtotal: it.subtotal,
                })),
              });

              return (
                <div
                  key={q.id}
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "1.5rem",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  {/* Top Bar */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      borderBottom: "1px solid var(--surface-divider)",
                      paddingBottom: "1rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>
                          {q.number}
                        </span>
                        <span
                          style={{
                            fontSize: "0.76rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.65rem",
                            borderRadius: "var(--radius-full)",
                            background: badge.bg,
                            color: badge.color,
                            border: badge.border,
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        Fecha de solicitud: {formatDate(q.created_at)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Total estimado:</div>
                      <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--accent)" }}>
                        {formatCurrency(q.total)}
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div style={{ marginBottom: "1.25rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
                      Detalle de Productos:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {(q.quotation_items || []).map((it: any) => (
                        <div
                          key={it.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.88rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <span>
                            • <strong>{it.quantity} {it.unit}</strong> — {it.product_name}
                          </span>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {formatCurrency(it.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* WhatsApp Action Footer */}
                  <div
                    style={{
                      borderTop: "1px solid var(--surface-divider)",
                      paddingTop: "1rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "1rem",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <ShieldAlert size={14} color="#d97706" />
                      <span>Precios preliminares sujetos a confirmación técnica.</span>
                    </div>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "#25D366",
                        color: "#ffffff",
                        padding: "0.6rem 1.15rem",
                        borderRadius: "var(--radius-md)",
                        fontSize: "0.88rem",
                        fontWeight: 700,
                        textDecoration: "none",
                        boxShadow: "0 4px 12px rgba(37, 211, 102, 0.25)",
                        transition: "transform 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      <MessageCircle size={18} />
                      <span>Coordinar por WhatsApp</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
