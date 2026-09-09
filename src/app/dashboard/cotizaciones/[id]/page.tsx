"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency, formatDate, formatDateLong, getStatusLabel, getStatusColor } from "@/lib/formatters";
import { recalcQuotationItem, calcQuotationTotals } from "@/lib/calculations";
import { ArrowLeft, Save, FileDown, Trash2, Search, MessageCircle, GitBranch } from "lucide-react";
import Link from "next/link";

import { generateExcel } from "@/lib/excel-export";
import { fetchRucData } from "@/lib/ruc";
import type { Quotation, QuotationItem, QuotationStatus, CompanySettings } from "@/types";

const STATUSES: { value: QuotationStatus; label: string }[] = [
  { value: "borrador", label: "Generada" },
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
  const queryClient = useQueryClient();

  const quotationId = params.id as string;

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

  const { data: initialData, isLoading: loading } = useQuery({
    queryKey: ['quotation_detail', quotationId],
    queryFn: async () => {
      const [quotRes, itemsRes, settingsRes] = await Promise.all([
        supabase.from("quotations").select("*").eq("id", quotationId).single(),
        supabase.from("quotation_items").select("*").eq("quotation_id", quotationId).order("sort_order"),
        supabase.from("company_settings").select("*").limit(1).single(),
      ]);

      let revList: Array<{ id: string; number: string; revision: string | null; status: string; created_at: string }> = [];
      if (quotRes.data) {
        const q = quotRes.data as Quotation;
        const parentId = q.parent_id || q.id;
        const { data: revData } = await supabase
          .from("quotations")
          .select("id, number, revision, status, created_at")
          .or(`id.eq.${parentId},parent_id.eq.${parentId}`)
          .order("created_at", { ascending: true });
        
        revList = (revData || []).filter(r => r.id !== quotationId);
      }

      return {
        quotation: quotRes.data as Quotation | null,
        items: (itemsRes.data || []) as QuotationItem[],
        settings: (settingsRes.data || null) as CompanySettings | null,
        revisions: revList
      };
    }
  });

  useEffect(() => {
    if (initialData?.quotation) {
      const q = initialData.quotation;
      setClientName(q.client_name);
      setClientRuc(q.client_ruc || "");
      setClientAddress(q.client_address || "");
      setClientPhone(q.client_phone || "");
      setClientEmail(q.client_email || "");
      setNotes(q.notes || "");
      setValidityDays(q.validity_days);
      setStatus(q.status as QuotationStatus);
    }
    if (initialData?.items) {
      setItems(initialData.items);
    }
  }, [initialData]);

  const quotation = initialData?.quotation;
  const settings = initialData?.settings;
  const revisions = initialData?.revisions || [];

  async function handleRucSearch() {
    if (clientRuc.length !== 11) return;
    try {
      setSearchingRuc(true);

      // Check if client is already in our database
      const { data: existingClient } = await supabase
        .from("clients")
        .select("*")
        .eq("ruc", clientRuc)
        .maybeSingle();

      if (existingClient) {
        setClientName(existingClient.name);
        setClientAddress(existingClient.address || "");
        setClientPhone(existingClient.phone || "");
        setClientEmail(existingClient.email || "");
        showToast("Datos de cliente recuperados");
        return;
      }

      // If not, fetch from external API
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

  function updateItem(index: number, changes: Partial<QuotationItem>) {
    const updated = [...items];
    updated[index] = recalcQuotationItem(updated[index], {
      quantity: changes.quantity,
      margin_percent: changes.margin_percent,
      unit_cost: changes.unit_cost,
      has_labor: changes.has_labor,
      has_design: changes.has_design,
      has_transport: changes.has_transport,
    });
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const igvRate = quotation?.igv_rate ?? settings?.igv_rate ?? 0.18;
  const totals = calcQuotationTotals(items, igvRate);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clientName.trim()) {
        throw new Error("Nombre del cliente es obligatorio");
      }

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

      if (error) throw new Error(error.message);

      const itemsPayload = items.map((item, idx) => ({
        product_id: item.product_id || null,
        item_type: item.item_type || 'Producto',
        has_labor: item.has_labor ?? true,
        has_design: item.has_design ?? true,
        design_cost: item.design_cost || 0,
        has_transport: item.has_transport ?? true,
        transport_cost: item.transport_cost || 0,
        client_design_url: item.client_design_url || null,
        sort_order: idx,
        product_code: item.product_code || null,
        product_name: item.product_name,
        product_description: item.product_description || null,
        unit: item.unit,
        material_cost: item.material_cost,
        labor_cost: item.labor_cost,
        indirect_cost: item.indirect_cost,
        unit_cost: item.unit_cost,
        quantity: item.quantity,
        margin_percent: item.margin_percent,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

      const { error: rpcError } = await supabase.rpc("replace_quotation_items", {
        p_quotation_id: quotationId,
        p_items: itemsPayload,
      });

      if (rpcError) {
        console.warn("RPC replace_quotation_items not available, using fallback:", rpcError);
        const { error: deleteError } = await supabase
          .from("quotation_items")
          .delete()
          .eq("quotation_id", quotationId);

        if (deleteError) {
          throw new Error("Error al actualizar ítems: " + deleteError.message);
        }

        if (items.length > 0) {
          const { error: insertError } = await supabase.from("quotation_items").insert(
            itemsPayload.map((item) => ({ ...item, quotation_id: quotationId }))
          );

          if (insertError) {
            throw new Error("Error crítico: los ítems no se pudieron guardar. Revisa la cotización.");
          }
        }
      }
    },
    onSuccess: () => {
      showToast("Cotización actualizada");
      queryClient.invalidateQueries({ queryKey: ['quotation_detail', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['quotations_list'] });
    },
    onError: (error: any) => {
      showToast("Error: " + error.message, "error");
    }
  });

  async function handleExportPDF() {
    if (!quotation || !settings) return;
    window.open(`/api/pdf/${quotation.id}`, "_blank");
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

    await handleExportPDF();

    let phone = clientPhone.replace(/\D/g, "");
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
        .then(() => queryClient.invalidateQueries({ queryKey: ['quotation_detail', quotationId] }));
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1>{quotation.number}</h1>
              {quotation.revision && (
                <span className="badge" style={{ 
                  background: "var(--info-light)", color: "var(--info)",
                  fontSize: "0.75rem", fontWeight: 700,
                }}>
                  <GitBranch size={12} style={{ marginRight: 4 }} />
                  Revisión {quotation.revision}
                </span>
              )}
            </div>
            <p className="subtitle">
              Creada el {formatDateLong(quotation.created_at)} ·{" "}
              <span
                style={{ color: getStatusColor(quotation.status), fontWeight: 600 }}
              >
                {getStatusLabel(quotation.status)}
              </span>
              {quotation.parent_id && (
                <>
                  {" · "}
                  <Link href={`/dashboard/cotizaciones/${quotation.parent_id}`} style={{ color: "var(--accent)", fontSize: "0.85rem" }}>
                    Ver original
                  </Link>
                </>
              )}
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
                        <React.Fragment key={i}>
                          <tr>
                            <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{i + 1}</td>
                            <td className="primary" style={{ fontSize: "0.82rem" }}>
                              <div>
                                {item.product_name}
                                {item.item_type && <span style={{ marginLeft: 6, fontSize: '0.65rem', padding: '2px 6px', background: 'var(--surface-hover)', borderRadius: 12 }}>{item.item_type}</span>}
                              </div>
                              {item.product_code && (
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                  {item.product_code}
                                </div>
                              )}
                              {(item.item_type === 'Servicio' && item.has_design === false) && (
                                <div style={{ marginTop: 4, padding: 6, background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                                  <span style={{ fontSize: '0.7rem', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                                    Diseño adjunto por cliente
                                  </span>
                                  {item.client_design_url ? (
                                    <a href={item.client_design_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>Ver archivo</a>
                                  ) : (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ninguno</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td style={{ fontSize: "0.8rem" }}>{item.unit}</td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min={0.01}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(i, { quantity: Number(e.target.value) })
                                }
                                style={{ width: 70 }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={item.unit_cost}
                                onChange={(e) =>
                                  updateItem(i, { unit_cost: Number(e.target.value) })
                                }
                                style={{ width: 100 }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="1"
                                min={0}
                                value={item.margin_percent}
                                onChange={(e) =>
                                  updateItem(i, { margin_percent: Number(e.target.value) })
                                }
                                style={{ width: 80 }}
                              />
                            </td>
                            <td style={{ fontWeight: 600 }}>{formatCurrency(calcUnitPrice(item.unit_cost, item.margin_percent))}</td>
                            <td style={{ fontWeight: 600, color: "var(--success)" }}>
                              {formatCurrency(calcItemSubtotal(item.quantity, calcUnitPrice(item.unit_cost, item.margin_percent)))}
                            </td>
                            <td className="row-actions">
                              <button
                                type="button"
                                className="icon-btn danger"
                                onClick={() => removeItem(i)}
                                title="Eliminar ítem"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                          
                          {item.item_type === 'Servicio' && (item.labor_cost || 0) > 0 && (
                            <tr style={{ background: item.has_labor ? 'var(--bg-glass)' : 'transparent', opacity: item.has_labor ? 1 : 0.5 }}>
                              <td></td>
                              <td>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', textTransform: 'none', margin: 0, fontWeight: 500, letterSpacing: 'normal', paddingLeft: 12 }}>
                                  <input 
                                    type="checkbox" 
                                    checked={item.has_labor ?? true} 
                                    onChange={(e) => updateItem(i, { has_labor: e.target.checked })}
                                    style={{ width: 'auto', margin: 0 }}
                                  /> 
                                  Mano de Obra
                                </label>
                              </td>
                              <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>hr</td>
                              <td>
                                <input type="number" step="0.01" min={0} value={item.labor_quantity ?? 1} onChange={(e) => updateItem(i, { labor_quantity: Number(e.target.value) })} style={{ width: 70 }} disabled={!item.has_labor} />
                              </td>
                              <td>
                                <input type="number" step="0.01" min={0} value={item.labor_unit_cost ?? 0} onChange={(e) => updateItem(i, { labor_unit_cost: Number(e.target.value) })} style={{ width: 100 }} disabled={!item.has_labor} />
                              </td>
                              <td>
                                <input type="number" step="1" min={0} value={item.labor_margin_percent ?? item.margin_percent} onChange={(e) => updateItem(i, { labor_margin_percent: Number(e.target.value) })} style={{ width: 80 }} disabled={!item.has_labor} />
                              </td>
                              <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                {formatCurrency(calcUnitPrice(item.labor_unit_cost ?? 0, item.labor_margin_percent ?? item.margin_percent))}
                              </td>
                              <td style={{ fontSize: "0.8rem", color: item.has_labor ? "var(--success)" : "var(--text-muted)" }}>
                                {formatCurrency(calcItemSubtotal(item.labor_quantity ?? 1, calcUnitPrice(item.labor_unit_cost ?? 0, item.labor_margin_percent ?? item.margin_percent)))}
                              </td>
                              <td></td>
                            </tr>
                          )}
                          
                          {item.item_type === 'Servicio' && (item.design_cost || 0) > 0 && (
                            <tr style={{ background: item.has_design ? 'var(--bg-glass)' : 'transparent', opacity: item.has_design ? 1 : 0.5 }}>
                              <td></td>
                              <td>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', textTransform: 'none', margin: 0, fontWeight: 500, letterSpacing: 'normal', paddingLeft: 12 }}>
                                  <input 
                                    type="checkbox" 
                                    checked={item.has_design ?? true} 
                                    onChange={(e) => updateItem(i, { has_design: e.target.checked })}
                                    style={{ width: 'auto', margin: 0 }}
                                  /> 
                                  Diseño Gráfico
                                </label>
                              </td>
                              <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>hr</td>
                              <td>
                                <input type="number" step="0.01" min={0} value={item.design_quantity ?? 1} onChange={(e) => updateItem(i, { design_quantity: Number(e.target.value) })} style={{ width: 70 }} disabled={!item.has_design} />
                              </td>
                              <td>
                                <input type="number" step="0.01" min={0} value={item.design_unit_cost ?? 0} onChange={(e) => updateItem(i, { design_unit_cost: Number(e.target.value) })} style={{ width: 100 }} disabled={!item.has_design} />
                              </td>
                              <td>
                                <input type="number" step="1" min={0} value={item.design_margin_percent ?? item.margin_percent} onChange={(e) => updateItem(i, { design_margin_percent: Number(e.target.value) })} style={{ width: 80 }} disabled={!item.has_design} />
                              </td>
                              <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                {formatCurrency(calcUnitPrice(item.design_unit_cost ?? 0, item.design_margin_percent ?? item.margin_percent))}
                              </td>
                              <td style={{ fontSize: "0.8rem", color: item.has_design ? "var(--success)" : "var(--text-muted)" }}>
                                {formatCurrency(calcItemSubtotal(item.design_quantity ?? 1, calcUnitPrice(item.design_unit_cost ?? 0, item.design_margin_percent ?? item.margin_percent)))}
                              </td>
                              <td></td>
                            </tr>
                          )}

                          {item.item_type === 'Servicio' && (item.transport_cost || 0) > 0 && (
                            <tr style={{ background: item.has_transport ? 'var(--bg-glass)' : 'transparent', opacity: item.has_transport ? 1 : 0.5 }}>
                              <td></td>
                              <td>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', textTransform: 'none', margin: 0, fontWeight: 500, letterSpacing: 'normal', paddingLeft: 12 }}>
                                  <input 
                                    type="checkbox" 
                                    checked={item.has_transport ?? true} 
                                    onChange={(e) => updateItem(i, { has_transport: e.target.checked })}
                                    style={{ width: 'auto', margin: 0 }}
                                  /> 
                                  Transporte / Movilidad
                                </label>
                              </td>
                              <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>viaje</td>
                              <td>
                                <input type="number" step="0.01" min={0} value={item.transport_quantity ?? 1} onChange={(e) => updateItem(i, { transport_quantity: Number(e.target.value) })} style={{ width: 70 }} disabled={!item.has_transport} />
                              </td>
                              <td>
                                <input type="number" step="0.01" min={0} value={item.transport_unit_cost ?? 0} onChange={(e) => updateItem(i, { transport_unit_cost: Number(e.target.value) })} style={{ width: 100 }} disabled={!item.has_transport} />
                              </td>
                              <td>
                                <input type="number" step="1" min={0} value={item.transport_margin_percent ?? item.margin_percent} onChange={(e) => updateItem(i, { transport_margin_percent: Number(e.target.value) })} style={{ width: 80 }} disabled={!item.has_transport} />
                              </td>
                              <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                {formatCurrency(calcUnitPrice(item.transport_unit_cost ?? 0, item.transport_margin_percent ?? item.margin_percent))}
                              </td>
                              <td style={{ fontSize: "0.8rem", color: item.has_transport ? "var(--success)" : "var(--text-muted)" }}>
                                {formatCurrency(calcItemSubtotal(item.transport_quantity ?? 1, calcUnitPrice(item.transport_unit_cost ?? 0, item.transport_margin_percent ?? item.margin_percent)))}
                              </td>
                              <td></td>
                            </tr>
                          )}
                        </React.Fragment>
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
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                style={{ width: "100%", marginTop: "var(--space-lg)" }}
              >
                <Save size={16} />
                {saveMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>

            {/* Revision History */}
            {revisions.length > 0 && (
              <div className="card" style={{ marginTop: "var(--space-lg)" }}>
                <h3 className="card-title" style={{ marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: 8 }}>
                  <GitBranch size={16} /> Historial de Revisiones
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {revisions.map(rev => (
                    <Link
                      key={rev.id}
                      href={`/dashboard/cotizaciones/${rev.id}`}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 10px", borderRadius: "var(--radius-md)",
                        background: "var(--bg-tertiary)",
                        textDecoration: "none", color: "inherit",
                        transition: "background 0.15s",
                        border: "1px solid transparent",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-light)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                    >
                      <div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                          {rev.number}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {formatDate(rev.created_at)}
                        </div>
                      </div>
                      <span className="badge" style={{
                        background: `${getStatusColor(rev.status as QuotationStatus)}20`,
                        color: getStatusColor(rev.status as QuotationStatus),
                        fontSize: "0.7rem",
                      }}>
                        {getStatusLabel(rev.status as QuotationStatus)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
