"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { generateClientToAdminWhatsAppUrl } from "@/lib/whatsapp";
import {
  CheckCircle2,
  MessageCircle,
  FileDown,
  Mail,
  FileText,
  Plus,
} from "lucide-react";

export default function CotizacionListaPage() {
  const params = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());

  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState<any>(null);
  const [companyPhone, setCompanyPhone] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        // El teléfono NO se lee de `company_settings` desde el navegador: esa tabla
        // es sólo del administrador y para el cliente volvía vacía, con lo cual el
        // enlace de WhatsApp caía al número de relleno de `whatsapp.ts:31`.
        const resCfg = await fetch("/api/public/settings", { cache: "no-store" });
        const settings = await resCfg.json();
        if (settings?.phone) setCompanyPhone(settings.phone);

        // La cotización se lee con la sesión del usuario, NO con el cliente
        // administrador: la RLS es la que decide si es suya. Si no lo es, no
        // vuelve fila y la pantalla lo dice sin confirmar que el id exista.
        const { data } = await supabase
          .from("quotations")
          .select("*, quotation_items(*)")
          .eq("id", params.id)
          .is("deleted_at", null)
          .maybeSingle();

        setQuotation(data ?? null);
      } catch (err) {
        console.error("Error cargando la cotización:", err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [supabase, params.id]);

  async function handleEnviarCorreo() {
    setEnviando(true);
    try {
      const res = await fetch(`/api/quotations/${params.id}/email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar el correo.");
      setEnviado(true);
      showToast(`Cotización enviada a ${data.to}`);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setEnviando(false);
    }
  }

  const whatsappUrl = quotation
    ? generateClientToAdminWhatsAppUrl({
        adminPhone: companyPhone,
        quotationNumber: quotation.number,
        clientName: quotation.client_name,
        total: Number(quotation.total),
        items: (quotation.quotation_items || []).map((it: any) => ({
          name: it.product_name,
          quantity: it.quantity,
          unit: it.unit,
          subtotal: Number(it.subtotal),
        })),
      })
    : "";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
      <PublicNavbar />

      <main style={{ maxWidth: "680px", margin: "0 auto", padding: "2.5rem 1.5rem", width: "100%", flex: 1 }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Cargando…</p>
        ) : !quotation ? (
          <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Cotización no encontrada
            </h1>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
              No existe o no pertenece a tu cuenta.
            </p>
            <Link href="/mis-cotizaciones" prefetch={false} className="btn btn-secondary">
              Ver mis cotizaciones
            </Link>
          </div>
        ) : (
          <div
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--surface-border)",
              borderRadius: "var(--radius-xl)",
              padding: "2.5rem 2rem",
              textAlign: "center",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.12)",
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem auto",
              }}
            >
              <CheckCircle2 size={44} />
            </div>

            <div
              style={{
                display: "inline-block",
                padding: "0.25rem 0.85rem",
                borderRadius: "var(--radius-full)",
                background: "var(--accent-light)",
                color: "var(--accent)",
                fontSize: "0.85rem",
                fontWeight: 700,
                marginBottom: "0.75rem",
              }}
            >
              {quotation.number}
            </div>

            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              ¡Tu cotización ha sido generada!
            </h1>

            <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.5, marginBottom: "1.75rem" }}>
              Total preliminar{" "}
              <strong style={{ color: "var(--text-primary)", fontSize: "1.15rem" }}>
                {formatCurrency(Number(quotation.total))}
              </strong>
              . Descargala, recibila por correo o coordiná los detalles con un asesor.
            </p>

            {/* Las tres entregas */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.75rem",
                  width: "100%",
                  background: "#25D366",
                  color: "#ffffff",
                  padding: "1rem 1.5rem",
                  borderRadius: "var(--radius-lg)",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 8px 20px rgba(37, 211, 102, 0.35)",
                }}
              >
                <MessageCircle size={22} />
                <span>Confirmar por WhatsApp con un Asesor</span>
              </a>

              <a
                href={`/api/pdf/${quotation.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ width: "100%", padding: "0.9rem", fontSize: "0.95rem", justifyContent: "center" }}
              >
                <FileDown size={18} />
                <span>Descargar PDF</span>
              </a>

              <button
                onClick={handleEnviarCorreo}
                disabled={enviando || enviado || !quotation.client_email}
                className="btn btn-secondary"
                style={{ width: "100%", padding: "0.9rem", fontSize: "0.95rem", justifyContent: "center" }}
                title={
                  quotation.client_email
                    ? `Se enviará a ${quotation.client_email}`
                    : "Esta cotización no tiene correo registrado"
                }
              >
                <Mail size={18} />
                <span>
                  {enviado
                    ? "Enviado ✓"
                    : enviando
                    ? "Enviando…"
                    : quotation.client_email
                    ? `Enviar por correo a ${quotation.client_email}`
                    : "Sin correo registrado"}
                </span>
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "1rem",
                flexWrap: "wrap",
                borderTop: "1px solid var(--surface-divider)",
                paddingTop: "1.5rem",
              }}
            >
              <Link href="/mis-cotizaciones" prefetch={false} className="btn btn-ghost" style={{ fontSize: "0.9rem" }}>
                <FileText size={16} />
                <span>Ver en Mis Cotizaciones</span>
              </Link>
              <Link href="/" prefetch={false} className="btn btn-ghost" style={{ fontSize: "0.9rem" }}>
                <Plus size={16} />
                <span>Crear otra cotización</span>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
