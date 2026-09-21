"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency, formatDate, formatDateLong, getStatusLabel, getStatusColor } from "@/lib/formatters";
import {
  calcQuotationTotals,
  createQuotationItemFromProduct,
  recalcQuotationItem,
  repriceItemFromComponents,
  calcUnitPrice,
  calcItemSubtotal,
  type QuotationItemComponent,
} from "@/lib/calculations";
import { saveQuotationItems } from "@/lib/quotation-save";
import { withComponents } from "@/lib/quotation-components";
import { ArrowLeft, Save, FileDown, Trash2, Search, MessageCircle, GitBranch, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { fetchDocumentData } from "@/lib/ruc";
import type { Quotation, QuotationItem, QuotationStatus, CompanySettings } from "@/types";

const STATUSES: { value: QuotationStatus; label: string }[] = [
  { value: "borrador", label: "Generada" },
  { value: "enviada", label: "Enviada" },
  { value: "aceptada", label: "Aceptada" },
  { value: "pagado", label: "Pagada" },
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
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [searchingRuc, setSearchingRuc] = useState(false);

  const { data: initialData, isLoading: loading, isError: catalogError, refetch: refetchCatalog } = useQuery({
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
          .is("deleted_at", null)
          .order("created_at", { ascending: true });
        
        revList = (revData || []).filter(r => r.id !== quotationId);
      }

      const fetchedItems = (itemsRes.data || []) as QuotationItem[];

      // SUBC: cargar la receta de cada ítem. Si la tabla todavía no existe
      // (base sin la migración), vuelven con receta vacía y se imprime legado.
      const itemsWithComponents = await withComponents(supabase, fetchedItems);

      return {
        quotation: quotRes.data as Quotation | null,
        items: itemsWithComponents as (QuotationItem & { _components: QuotationItemComponent[] })[],
        settings: (settingsRes.data || null) as CompanySettings | null,
        revisions: revList
      };
    }
  });

  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (seededFor.current === quotationId) return;
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
      setPaymentMethod(q.payment_method || "");
      if (initialData.items) {
        setItems(initialData.items);
      }
      seededFor.current = quotationId;
    }
  }, [initialData, quotationId]);

  const quotation = initialData?.quotation;
  const settings = initialData?.settings;
  const revisions = initialData?.revisions || [];

  async function handleRucSearch() {
    const doc = clientRuc.replace(/\D/g, "");
    if (doc.length !== 8 && doc.length !== 11) return;
    try {
      setSearchingRuc(true);

      // Check if client is already in our database
      const { data: existingClient } = await supabase
        .from("clients")
        .select("*")
        .eq("ruc", doc)
        .limit(1)
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
      const data = await fetchDocumentData(doc);
      setClientName(data.nombre);
      if (data.direccion) {
        setClientAddress(data.direccion);
      }
      showToast(data.tipo === 'DNI' ? "Datos de Reniec obtenidos" : "Datos de Sunat obtenidos");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSearchingRuc(false);
    }
  }

  const [subiendoArte, setSubiendoArte] = useState<number | null>(null);

  async function handleArtUpload(index: number, file: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast("Tu sesión expiró. Vuelve a iniciarla.", "error");
      return;
    }
    setSubiendoArte(index);
    try {
      const ext = file.name.split(".").pop();
      const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      // El primer segmento DEBE ser el uid: lo exige la política del bucket.
      const ruta = `${user.id}/${nombre}`;

      const { error } = await supabase.storage.from("client-art").upload(ruta, file);
      if (error) throw error;

      // La ruta NO pasa por recalcQuotationItem: su lista de overrides es
      // cerrada y la descartaría en silencio (ver ARQUITECTURA §4.5).
      setItems((prev) => prev.map((it, k) => k === index ? { ...it, client_design_url: ruta } : it));
      showToast("Arte adjuntado. Guardá la cotización para conservarlo.");
    } catch (err: any) {
      showToast(err?.message || "No se pudo subir el archivo", "error");
    } finally {
      setSubiendoArte(null);
    }
  }

  // La observación NO pasa por recalcQuotationItem: su lista de overrides es
  // cerrada y descartaría el campo en silencio. Tampoco lo necesita — una nota
  // no altera ningún precio.
  function updateItemNotes(index: number, notes: string) {
    setItems((prev) => prev.map((it, k) => k === index ? { ...it, notes } : it));
  }

  function updateItem(index: number, changes: Partial<QuotationItem>) {
    const updated = [...items];
    // Reenviar `changes` COMPLETO. recalcQuotationItem resuelve cada campo con
    // `overrides?.x ?? item.x`, así que pasarlo tal cual es seguro y elimina la
    // lista blanca de 6 campos que dejaba inertes los 9 inputs de componente.
    updated[index] = recalcQuotationItem(updated[index], changes as any);
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
          payment_method: status === "pagado" ? (paymentMethod || null) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quotationId);

      if (error) throw new Error(error.message);

      // El guardado de ítems vive en src/lib/quotation-save.ts: acá adentro no
      // había manera de ejercitar el ciclo abrir -> guardar con una prueba.
      await saveQuotationItems(supabase, quotationId, items);
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

  async function handleExportExcel() {
    if (!quotation || !settings) return;
    if (saveMutation.isPending) { showToast("Esperá a que termine el guardado", "error"); return; }
    if (totals.total !== Number(quotation.total)) {
      showToast("Hay cambios sin guardar: guardá antes de exportar", "error");
      return;
    }
    const { generateExcel } = await import("@/lib/excel-export");
    generateExcel({ ...quotation, items } as Quotation, settings);
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

  if (catalogError) {
    return (
      <div className="page-body">
        <div className="card" style={{ padding: "2rem", textAlign: "center", maxWidth: 500, margin: "2rem auto" }}>
          <ShieldAlert size={36} style={{ color: "var(--danger)", marginBottom: 12 }} />
          <h3>No pudimos cargar la cotización</h3>
          <p className="subtitle" style={{ marginBottom: 16 }}>
            Puede ser una falla momentánea de conexión.
          </p>
          <button className="btn btn-secondary" onClick={() => refetchCatalog()}>
            Reintentar
          </button>
        </div>
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
                  <label>RUC / DNI</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input 
                      value={clientRuc} 
                      onChange={(e) => setClientRuc(e.target.value.replace(/\D/g, "").slice(0, 11))} 
                      maxLength={11} 
                      placeholder="20123456789 o DNI" 
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={handleRucSearch}
                      disabled={searchingRuc || (clientRuc.length !== 8 && clientRuc.length !== 11)}
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
                              {/* Arte adjunto: ahora en fila propia (ADJ-T2) */}
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
                            {/* P.V. Unit y Subtotal salen del ítem ya valorizado
                                (recalcQuotationItem / repriceItemFromComponents), no de
                                una cuenta propia de esta pantalla. Con receta cargada,
                                `unit_cost x margen` es el precio de una PARTE —la base
                                sin mano de obra— y mostraba 168.75 mientras el pie de la
                                cotización decía 195.75. */}
                            <td style={{ fontWeight: 600 }}>{formatCurrency(Number(item.unit_price) || 0)}</td>
                            <td style={{ fontWeight: 600, color: "var(--success)" }}>
                              {formatCurrency(Number(item.subtotal) || 0)}
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
                          
                          {/* Descripción del ítem. Va al inicio: antes de los componentes. */}
                          <tr>
                            <td />
                            <td colSpan={8} style={{ paddingTop: "0.25rem", paddingBottom: "0.5rem" }}>
                              <textarea
                                value={item.notes ?? ""}
                                onChange={(e) => updateItemNotes(i, e.target.value)}
                                placeholder="Descripción (opcional)"
                                rows={2}
                                style={{ width: "100%", fontSize: "0.78rem", resize: "vertical" }}
                              />
                            </td>
                          </tr>

                          {/* SUBC: subcomponentes agrupados por categor\u00eda.
                              Si el \u00edtem trae _components (cotizaciones nuevas), se usan.
                              Si no (cotizaciones viejas o sin receta), se muestran las
                              tres filas legacy de labor/design/transport. */}
                          {(() => {
                            const comps: QuotationItemComponent[] = (item as any)._components ?? [];
                            if (comps.length > 0) {
                              const CATEGORY_LABELS: Record<string, string> = {
                                material: 'MATERIALES', labor: 'MANO DE OBRA',
                                production: 'PRODUCCI\u00d3N', other: 'OTROS',
                              };
                              const CATEGORY_ORDER = ['material', 'labor', 'production', 'other'];
                              const byCategory = CATEGORY_ORDER
                                .map((cat) => ({ cat, rows: comps.map((c, ci) => ({ c, ci })).filter(({ c }) => c.category === cat) }))
                                .filter(({ rows }) => rows.length > 0);

                              return (
                                <>
                                  {/* Fila de encabezado de subcomponentes */}
                                  <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <td />
                                    <td style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 16, paddingTop: 6 }}>
                                      Subcomponentes
                                    </td>
                                    <td style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unidad</td>
                                    <td style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cant.</td>
                                    <td style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Costo U.</td>
                                    <td style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Margen %</td>
                                    <td style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>P.V. Unit</td>
                                    <td style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subtotal</td>
                                    <td />
                                  </tr>
                                  {byCategory.map(({ cat, rows }) => (
                                    <React.Fragment key={cat}>
                                      {/* Header de categor\u00eda */}
                                      <tr>
                                        <td />
                                        <td colSpan={8} style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', paddingLeft: 16, paddingTop: 8, paddingBottom: 2 }}>
                                          — {CATEGORY_LABELS[cat] ?? cat}
                                        </td>
                                      </tr>
                                      {rows.map(({ c, ci }) => {
                                        const effectiveQty = c.scope === 'unit' ? (Number(item.quantity) || 1) : 1;
                                        const pvUnit = Math.round(c.unit_cost * (1 + c.margin_percent / 100) * 100) / 100;
                                        const subtotal = c.is_included ? Math.round(pvUnit * c.quantity * (c.scope === 'unit' ? (Number(item.quantity) || 1) : 1) * 100) / 100 : 0;
                                        return (
                                          <tr key={ci} style={{ background: c.is_included ? 'var(--bg-glass)' : 'transparent', opacity: c.is_included ? 1 : 0.5 }}>
                                            <td />
                                            <td>
                                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', textTransform: 'none', margin: 0, fontWeight: 500, letterSpacing: 'normal', paddingLeft: 12 }}>
                                                <input
                                                  type="checkbox"
                                                  checked={c.is_included}
                                                  onChange={(e) => {
                                                    const updated = items.map((it, k) => {
                                                      if (k !== i) return it;
                                                      const newComps = [...((it as any)._components ?? [])];
                                                      newComps[ci] = { ...newComps[ci], is_included: e.target.checked };
                                                      return repriceItemFromComponents({ ...it, _components: newComps } as any);
                                                    });
                                                    setItems(updated);
                                                  }}
                                                  style={{ width: 'auto', margin: 0 }}
                                                />
                                                {c.label}
                                              </label>
                                            </td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.unit ?? '—'}</td>
                                            <td>
                                              <input
                                                type="number" step="0.01" min={0}
                                                value={c.quantity}
                                                onChange={(e) => {
                                                  const updated = items.map((it, k) => {
                                                    if (k !== i) return it;
                                                    const nc = [...((it as any)._components ?? [])];
                                                    nc[ci] = { ...nc[ci], quantity: Number(e.target.value) };
                                                    return repriceItemFromComponents({ ...it, _components: nc } as any);
                                                  });
                                                  setItems(updated);
                                                }}
                                                style={{ width: 70 }}
                                                disabled={!c.is_included}
                                              />
                                            </td>
                                            <td>
                                              <input
                                                type="number" step="0.01" min={0}
                                                value={c.unit_cost}
                                                onChange={(e) => {
                                                  const updated = items.map((it, k) => {
                                                    if (k !== i) return it;
                                                    const nc = [...((it as any)._components ?? [])];
                                                    nc[ci] = { ...nc[ci], unit_cost: Number(e.target.value) };
                                                    return repriceItemFromComponents({ ...it, _components: nc } as any);
                                                  });
                                                  setItems(updated);
                                                }}
                                                style={{ width: 100 }}
                                                disabled={!c.is_included}
                                              />
                                            </td>
                                            <td>
                                              <input
                                                type="number" step="1" min={0}
                                                value={c.margin_percent}
                                                onChange={(e) => {
                                                  const updated = items.map((it, k) => {
                                                    if (k !== i) return it;
                                                    const nc = [...((it as any)._components ?? [])];
                                                    nc[ci] = { ...nc[ci], margin_percent: Number(e.target.value) };
                                                    return repriceItemFromComponents({ ...it, _components: nc } as any);
                                                  });
                                                  setItems(updated);
                                                }}
                                                style={{ width: 80 }}
                                                disabled={!c.is_included}
                                              />
                                            </td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                              {formatCurrency(pvUnit)}
                                            </td>
                                            <td style={{ fontSize: '0.8rem', color: c.is_included ? 'var(--success)' : 'var(--text-muted)' }}>
                                              {formatCurrency(subtotal)}
                                            </td>
                                            <td />
                                          </tr>
                                        );
                                      })}
                                    </React.Fragment>
                                  ))}
                                </>
                              );
                            }

                            // LEGADO: sin subcomponentes, mostrar las tres filas fijas.
                            return (
                              <>
                                {(item.labor_unit_cost ?? item.labor_cost ?? 0) > 0 && (
                                  <tr style={{ background: item.has_labor ? 'var(--bg-glass)' : 'transparent', opacity: item.has_labor ? 1 : 0.5 }}>
                                    <td></td>
                                    <td>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', textTransform: 'none', margin: 0, fontWeight: 500, letterSpacing: 'normal', paddingLeft: 12 }}>
                                        <input type="checkbox" checked={item.has_labor ?? true} onChange={(e) => updateItem(i, { has_labor: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
                                        Mano de Obra
                                      </label>
                                    </td>
                                    <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>hr</td>
                                    <td><input type="number" step="0.01" min={0} value={item.labor_quantity ?? 1} onChange={(e) => updateItem(i, { labor_quantity: Number(e.target.value) })} style={{ width: 70 }} disabled={!item.has_labor} /></td>
                                    <td><input type="number" step="0.01" min={0} value={item.labor_unit_cost ?? 0} onChange={(e) => updateItem(i, { labor_unit_cost: Number(e.target.value) })} style={{ width: 100 }} disabled={!item.has_labor} /></td>
                                    <td><input type="number" step="1" min={0} value={item.labor_margin_percent ?? item.margin_percent} onChange={(e) => updateItem(i, { labor_margin_percent: Number(e.target.value) })} style={{ width: 80 }} disabled={!item.has_labor} /></td>
                                    <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{formatCurrency(calcUnitPrice(item.labor_unit_cost ?? 0, item.labor_margin_percent ?? item.margin_percent))}</td>
                                    <td style={{ fontSize: "0.8rem", color: item.has_labor ? "var(--success)" : "var(--text-muted)" }}>{formatCurrency(calcItemSubtotal(item.labor_quantity ?? 1, calcUnitPrice(item.labor_unit_cost ?? 0, item.labor_margin_percent ?? item.margin_percent)))}</td>
                                    <td></td>
                                  </tr>
                                )}
                                {(item.design_unit_cost ?? item.design_cost ?? 0) > 0 && (
                                  <tr style={{ background: item.has_design ? 'var(--bg-glass)' : 'transparent', opacity: item.has_design ? 1 : 0.5 }}>
                                    <td></td>
                                    <td>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', textTransform: 'none', margin: 0, fontWeight: 500, letterSpacing: 'normal', paddingLeft: 12 }}>
                                        <input type="checkbox" checked={item.has_design ?? true} onChange={(e) => updateItem(i, { has_design: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
                                        Dise\u00f1o Gr\u00e1fico
                                      </label>
                                    </td>
                                    <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>hr</td>
                                    <td><input type="number" step="0.01" min={0} value={item.design_quantity ?? 1} onChange={(e) => updateItem(i, { design_quantity: Number(e.target.value) })} style={{ width: 70 }} disabled={!item.has_design} /></td>
                                    <td><input type="number" step="0.01" min={0} value={item.design_unit_cost ?? 0} onChange={(e) => updateItem(i, { design_unit_cost: Number(e.target.value) })} style={{ width: 100 }} disabled={!item.has_design} /></td>
                                    <td><input type="number" step="1" min={0} value={item.design_margin_percent ?? item.margin_percent} onChange={(e) => updateItem(i, { design_margin_percent: Number(e.target.value) })} style={{ width: 80 }} disabled={!item.has_design} /></td>
                                    <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{formatCurrency(calcUnitPrice(item.design_unit_cost ?? 0, item.design_margin_percent ?? item.margin_percent))}</td>
                                    <td style={{ fontSize: "0.8rem", color: item.has_design ? "var(--success)" : "var(--text-muted)" }}>{formatCurrency(calcItemSubtotal(item.design_quantity ?? 1, calcUnitPrice(item.design_unit_cost ?? 0, item.design_margin_percent ?? item.margin_percent)))}</td>
                                    <td></td>
                                  </tr>
                                )}
                                {(item.transport_unit_cost ?? item.transport_cost ?? 0) > 0 && (
                                  <tr style={{ background: item.has_transport ? 'var(--bg-glass)' : 'transparent', opacity: item.has_transport ? 1 : 0.5 }}>
                                    <td></td>
                                    <td>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', textTransform: 'none', margin: 0, fontWeight: 500, letterSpacing: 'normal', paddingLeft: 12 }}>
                                        <input type="checkbox" checked={item.has_transport ?? true} onChange={(e) => updateItem(i, { has_transport: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
                                        Transporte / Movilidad
                                      </label>
                                    </td>
                                    <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>viaje</td>
                                    <td><input type="number" step="0.01" min={0} value={item.transport_quantity ?? 1} onChange={(e) => updateItem(i, { transport_quantity: Number(e.target.value) })} style={{ width: 70 }} disabled={!item.has_transport} /></td>
                                    <td><input type="number" step="0.01" min={0} value={item.transport_unit_cost ?? 0} onChange={(e) => updateItem(i, { transport_unit_cost: Number(e.target.value) })} style={{ width: 100 }} disabled={!item.has_transport} /></td>
                                    <td><input type="number" step="1" min={0} value={item.transport_margin_percent ?? item.margin_percent} onChange={(e) => updateItem(i, { transport_margin_percent: Number(e.target.value) })} style={{ width: 80 }} disabled={!item.has_transport} /></td>
                                    <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{formatCurrency(calcUnitPrice(item.transport_unit_cost ?? 0, item.transport_margin_percent ?? item.margin_percent))}</td>
                                    <td style={{ fontSize: "0.8rem", color: item.has_transport ? "var(--success)" : "var(--text-muted)" }}>{formatCurrency(calcItemSubtotal(item.transport_quantity ?? 1, calcUnitPrice(item.transport_unit_cost ?? 0, item.transport_margin_percent ?? item.margin_percent)))}</td>
                                    <td></td>
                                  </tr>
                                )}
                              </>
                            );
                          })()}

                          {/* Arte del cliente: fila propia, después de los componentes */}
                          {(item.has_design === false && (item.design_cost || 0) > 0) && (
                            <tr>
                              <td />
                              <td colSpan={8} style={{ paddingTop: 0, paddingBottom: 6 }}>
                                <div style={{ padding: 6, background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                                  <span style={{ fontSize: '0.7rem', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                                    Diseño adjunto por cliente
                                  </span>
                                  {item.client_design_url ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <a href={`/api/art?path=${encodeURIComponent(item.client_design_url)}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>Ver archivo</a>
                                      <button
                                        type="button"
                                        onClick={() => setItems((prev) => prev.map((it, k) => k === i ? { ...it, client_design_url: null } : it))}
                                        style={{ fontSize: '0.7rem', color: 'var(--error)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                      >
                                        Quitar
                                      </button>
                                    </div>
                                  ) : (
                                    <input
                                      key={`file-${(item as any).row_key ?? i}`}
                                      type="file"
                                      accept="image/*,.pdf,.ai,.psd"
                                      disabled={subiendoArte === i}
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleArtUpload(i, f);
                                      }}
                                      style={{ fontSize: '0.7rem', width: '100%' }}
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                          {/* El textarea de descripción ya está al inicio: ver arriba. */}
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
                {status === "pagado" && (
                  <div className="form-group">
                    <label>Método de Pago</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value="">Seleccione...</option>
                      <option value="Yape">Yape</option>
                      <option value="Plin">Plin</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Tarjeta">Tarjeta</option>
                    </select>
                  </div>
                )}
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
