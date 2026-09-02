"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency, formatDate, formatDateLong, getStatusLabel, getStatusColor } from "@/lib/formatters";
import { recalcQuotationItem, calcQuotationTotals } from "@/lib/calculations";
import { ArrowLeft, Save, FileDown, Trash2, Search, Plus, MessageCircle } from "lucide-react";
import Link from "next/link";
import { generatePDF } from "@/lib/pdf-export";
import { generateExcel } from "@/lib/excel-export";
import { fetchRucData } from "@/lib/ruc";
import type { Quotation, QuotationItem, QuotationStatus, CompanySettings } from "@/types";

const STATUSES: { value: QuotationStatus; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "Enviada" },
  { value: "aceptada", label: "Aceptada" },
  { value: "rechazada", label: "Rechazada" },
  { value: "vencida", label: "Vencida" },
];

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const quotationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientRuc, setClientRuc] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [validityDays, setValidityDays] = useState(15);
  const [status, setStatus] = useState<QuotationStatus>("borrador");
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [searchingRuc, setSearchingRuc] = useState(false);

  useEffect(() => {
    fetchData();
  }, [quotationId]);

  async function handleRucSearch() {
    if (clientRuc.length !== 11) return;
    try {
      setSearchingRuc(true);
      const data = await fetchRucData(clientRuc);
      setClientName(data.razonSocial);
      setClientAddress(data.direccion);
      showToast("Datos de Sunat obtenidos");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSearchingRuc(false);
    }
  }

  async function fetchData() {
    const [quotRes, itemsRes, settingsRes] = await Promise.all([
      supabase.from("quotations").select("*").eq("id", quotationId).single(),
      supabase.from("quotation_items").select("*").eq("quotation_id", quotationId).order("sort_order"),
      supabase.from("company_settings").select("*").limit(1).single(),
    ]);

    if (quotRes.data) {
      const q = quotRes.data as Quotation;
      setQuotation(q);
      setClientName(q.client_name);
      setClientRuc(q.client_ruc || "");
      setClientAddress(q.client_address || "");
      setClientPhone(q.client_phone || "");
      setClientEmail(q.client_email || "");
      setNotes(q.notes || "");
      setValidityDays(q.validity_days);
      setStatus(q.status);
    }

    setItems((itemsRes.data as QuotationItem[]) || []);
    setSettings(settingsRes.data as CompanySettings);
    setLoading(false);
  }

  function updateItem(index: number, changes: Partial<QuotationItem>) {
    const updated = [...items];
    updated[index] = recalcQuotationItem(updated[index], {
      quantity: changes.quantity,
      margin_percent: changes.margin_percent,
      unit_cost: changes.unit_cost,
    });
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const igvRate = quotation?.igv_rate ?? settings?.igv_rate ?? 0.18;
  const totals = calcQuotationTotals(items, igvRate);

  async function handleSave() {
    if (!clientName.trim()) {
      showToast("Nombre del cliente es obligatorio", "error");
      return;
    }
    setSaving(true);

    // Upsert client
    await supabase.from("clients").upsert(
      {
        name: clientName.trim(),
        ruc: clientRuc || null,
        address: clientAddress || null,
        phone: clientPhone || null,
        email: clientEmail || null,
      },
      { onConflict: "name" }
    );

    const { error } = await supabase
      .from("quotations")
      .update({
        client_name: clientName,
        client_ruc: clientRuc || null,
        client_address: clientAddress || null,
        client_phone: clientPhone || null,
        client_email: clientEmail || null,
        subtotal: totals.subtotal,
        igv_rate: igvRate,
        igv: totals.igv,
        total: totals.total,
        notes: notes || null,
        validity_days: validityDays,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quotationId);

    if (error) {
      showToast("Error: " + error.message, "error");
      setSaving(false);
      return;
    }

    // Replace items
    await supabase.from("quotation_items").delete().eq("quotation_id", quotationId);
    if (items.length > 0) {
      await supabase.from("quotation_items").insert(
        items.map((item, idx) => ({
          quotation_id: quotationId,
          product_id: item.product_id || null,
          sort_order: idx,
          product_code: item.product_code,
          product_name: item.product_name,
          product_description: item.product_description,
          unit: item.unit,
          material_cost: item.material_cost,
          labor_cost: item.labor_cost,
          indirect_cost: item.indirect_cost,
          unit_cost: item.unit_cost,
          quantity: item.quantity,
          margin_percent: item.margin_percent,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        }))
      );
    }

    showToast("Cotización actualizada");
    setSaving(false);
  }

  async function handleExportPDF() {
    if (!quotation || !settings) return;
    await generatePDF({ ...quotation, items, subtotal: totals.subtotal, igv: totals.igv, total: totals.total } as Quotation, settings);
    showToast("PDF generado");
  }

  function handleExportExcel() {
    if (!quotation || !settings) return;
    generateExcel({ ...quotation, items, subtotal: totals.subtotal, igv: totals.igv, total: totals.total } as Quotation, settings);
    showToast("Excel generado");
  }

  async function handleSendWhatsApp() {
    if (!quotation || !settings) return;
    if (!clientPhone) {
      showToast("El cliente no tiene un teléfono configurado", "error");
      return;
    }

    // Export PDF locally first
    await handleExportPDF();

    // Format phone number: remove non-digits
    let phone = clientPhone.replace(/\D/g, "");
    
    // Si asumes que tus clientes locales son de Perú (9 dígitos), agrega el +51. 
    // Cámbialo si es otro país por defecto.
    if (phone.length === 9) {
      phone = `51${phone}`;
    }

    const message = `Hola ${clientName}, adjunto la cotización ${quotation.number} por los servicios solicitados a ${settings.company_name}. El total es de ${formatCurrency(totals.total)}. ¡Quedo atento a tus comentarios!`;
    const encodedMessage = encodeURIComponent(message);
    
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, "_blank");
    
    if (status === "borrador") {
      setStatus("enviada");
      supabase
        .from("quotations")
        .update({ status: "enviada" })
        .eq("id", quotationId)
        .then();
    }
  }

  if (loading) {
    return (
      <div className="page-body">
        <div className="skeleton" style={{ height: 400, borderRadius: 14 }} />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="page-body">
        <div className="empty-state">
          <h3>Cotización no encontrada</h3>
          <Link href="/dashboard/cotizaciones" className="btn btn-primary">
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/dashboard/cotizaciones" className="btn-icon">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1>{quotation.number}</h1>
            <p className="subtitle">
              Creada el {formatDateLong(quotation.created_at)} ·{" "}
              <span
                style={{ color: getStatusColor(quotation.status), fontWeight: 600 }}
              >
                {getStatusLabel(quotation.status)}
              </span>
            </p>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExportExcel}>
            <FileDown size={16} /> Excel
          </button>
          <button className="btn btn-secondary" onClick={handleExportPDF}>
            <FileDown size={16} /> PDF
          </button>
          <button 
            className="btn" 
            onClick={handleSendWhatsApp}
            style={{ backgroundColor: "#25D366", color: "#fff", borderColor: "#25D366" }}
          >
            <MessageCircle size={16} /> WhatsApp
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="content-grid">
          <div>
            {/* Client Info */}
            <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
              <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
                👤 Datos del Cliente
              </h3>
              <div className="form-row">
                <div className="form-group">
                  <label>RUC</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input 
                      value={clientRuc} 
                      onChange={(e) => setClientRuc(e.target.value.replace(/\D/g, "").slice(0, 11))} 
                      maxLength={11} 
                      placeholder="20123456789" 
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={handleRucSearch}
                      disabled={searchingRuc || clientRuc.length !== 11}
                    >
                      {searchingRuc ? "..." : <Search size={18} />}
                    </button>
                  </div>
                  {clientRuc && clientRuc.length > 0 && clientRuc.length !== 11 && (
                    <span style={{ fontSize: "0.75rem", color: "var(--warning)", marginTop: 4 }}>
                      {11 - clientRuc.length} dígitos restantes
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label>Nombre / Razón Social *</label>
                  <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Teléfono</label>
                  <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
                📋 Ítems ({items.length})
              </h3>
              {items.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table className="cost-table">
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}>#</th>
                        <th>Producto</th>
                        <th style={{ width: 70 }}>Und.</th>
                        <th style={{ width: 80 }}>Cant.</th>
                        <th style={{ width: 110 }}>Costo U.</th>
                        <th style={{ width: 80 }}>Margen %</th>
                        <th style={{ width: 110 }}>P.V. Unit.</th>
                        <th style={{ width: 110 }}>Subtotal</th>
                        <th className="row-actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i}>
                          <td style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                          <td className="primary" style={{ fontSize: "0.82rem" }}>
                            {item.product_name}
                          </td>
                          <td>{item.unit}</td>
                          <td>
                            <input
                              type="number" step="0.01" min={0.01}
                              value={item.quantity}
                              onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                              style={{ width: 70 }}
                            />
                          </td>
                          <td>
                            <input
                              type="number" step="0.01" min={0}
                              value={item.unit_cost}
                              onChange={(e) => updateItem(i, { unit_cost: Number(e.target.value) })}
                              style={{ width: 100 }}
                            />
                          </td>
                          <td>
                            <input
                              type="number" step="1" min={0} max={200}
                              value={item.margin_percent}
                              onChange={(e) => updateItem(i, { margin_percent: Number(e.target.value) })}
                              style={{ width: 70 }}
                            />
                          </td>
                          <td style={{ fontWeight: 500 }}>{formatCurrency(item.unit_price)}</td>
                          <td style={{ color: "var(--success)", fontWeight: 600 }}>
                            {formatCurrency(item.subtotal)}
                          </td>
                          <td className="row-actions">
                            <button
                              className="btn-icon"
                              style={{ color: "var(--error)", width: 28, height: 28 }}
                              onClick={() => removeItem(i)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="card" style={{ marginTop: "var(--space-lg)" }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Estado</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as QuotationStatus)}>
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Validez (días)</label>
                  <input
                    type="number" min={1}
                    value={validityDays}
                    onChange={(e) => setValidityDays(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div>
            <div className="cost-breakdown" style={{ position: "sticky", top: 90 }}>
              <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>Resumen</h3>
              <div className="cost-breakdown-row">
                <span>Ítems</span>
                <span>{items.length}</span>
              </div>
              <div className="cost-breakdown-row total">
                <span>Subtotal</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="cost-breakdown-row">
                <span>IGV ({(igvRate * 100).toFixed(0)}%)</span>
                <span>{formatCurrency(totals.igv)}</span>
              </div>
              <div className="cost-breakdown-row grand-total">
                <span>TOTAL</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
              <button
                className="btn-primary"
                disabled={saving}
                onClick={handleSave}
                style={{ width: "100%", marginTop: "var(--space-lg)" }}
              >
                <Save size={16} />
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
