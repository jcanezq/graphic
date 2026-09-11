"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, getStatusLabel, getStatusColor, sanitizeSearch } from "@/lib/formatters";
import { Search, Plus, FileText, Eye, Edit2, Trash2, Copy, Download, LayoutGrid, List, GitBranch, MessageCircle, Globe, ShieldAlert, Filter, Calendar, Package } from "lucide-react";
import Link from "next/link";
import { toQuotationItemRow } from "@/lib/quotation-item-row";
import { useToast } from "@/components/ToastProvider";

import dynamic from "next/dynamic";
const KanbanBoard = dynamic(
  () => import("@/components/quotations/KanbanBoard").then((m) => m.KanbanBoard),
  { ssr: false, loading: () => <div className="skeleton" style={{ height: 400, borderRadius: 14 }} /> }
);
import { generateAdminToClientWhatsAppUrl } from "@/lib/whatsapp";
import type { Quotation, CompanySettings } from "@/types";


export default function QuotationsPage() {
  const supabase = createClient();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const [itemType, setItemType] = useState("");

  const [viewMode, setViewMode] = useState<"table" | "kanban">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("cotigrafic_view_mode") as "table" | "kanban") || "kanban";
    }
    return "kanban";
  });

  // Local state for kanban optimistic updates
  const [localQuotations, setLocalQuotations] = useState<Quotation[]>([]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedItemSearch(itemSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [search, itemSearch]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, debouncedItemSearch, itemType]);

  const { data: settings } = useQuery({
    queryKey: ['company_settings'],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").limit(1).single();
      return (data as CompanySettings) || null;
    }
  });

  const { data: queryData, isLoading: loading, isError: catalogError, refetch: refetchCatalog } = useQuery({
    queryKey: ['quotations_list', viewMode, currentPage, debouncedSearch, statusFilter, dateFrom, dateTo, debouncedItemSearch, itemType],
    queryFn: async () => {
      const selectColumns = debouncedItemSearch || itemType 
        ? "*, quotation_items!inner(product_name, item_type)"
        : "*";

      if (viewMode === "table") {
        let query = supabase
          .from("quotations")
          .select(selectColumns, { count: "exact" })
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (debouncedSearch) {
          const s = sanitizeSearch(debouncedSearch);
          query = query.or(`client_name.ilike.%${s}%,number.ilike.%${s}%`);
        }
        if (statusFilter) query = query.eq("status", statusFilter);
        if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
        if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
        if (debouncedItemSearch) query = query.ilike("quotation_items.product_name", `%${sanitizeSearch(debouncedItemSearch)}%`);
        if (itemType) query = query.eq("quotation_items.item_type", itemType);

        const from = (currentPage - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        query = query.range(from, to);

        const { data, count } = await query;
        return { quotations: (data as any as Quotation[]) || [], count: count || 0 };
      } else {
        let query = supabase
          .from("quotations")
          .select(selectColumns)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(200);

        if (debouncedSearch) {
          const s = sanitizeSearch(debouncedSearch);
          query = query.or(`client_name.ilike.%${s}%,number.ilike.%${s}%`);
        }
        if (statusFilter) query = query.eq("status", statusFilter);
        if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
        if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
        if (debouncedItemSearch) query = query.ilike("quotation_items.product_name", `%${sanitizeSearch(debouncedItemSearch)}%`);
        if (itemType) query = query.eq("quotation_items.item_type", itemType);

        const { data } = await query;
        const d = (data as any as Quotation[]) || [];

        const groups = new Map<string, Quotation[]>();
        d.forEach(q => {
          const groupId = q.parent_id || q.id;
          if (!groups.has(groupId)) groups.set(groupId, []);
          groups.get(groupId)!.push(q);
        });

        const groupMaxDate = new Map<string, number>();
        groups.forEach((items, groupId) => {
          const maxTime = Math.max(...items.map(i => new Date(i.created_at).getTime()));
          groupMaxDate.set(groupId, maxTime);
        });

        const sortedQuotations = Array.from(groups.values())
          .sort((a, b) => {
             const groupIdA = a[0].parent_id || a[0].id;
             const groupIdB = b[0].parent_id || b[0].id;
             return groupMaxDate.get(groupIdB)! - groupMaxDate.get(groupIdA)!;
          })
          .flatMap(group => 
            group.sort((a, b) => {
              const revA = a.revision || "";
              const revB = b.revision || "";
              return revB.localeCompare(revA);
            })
          );

        return { quotations: sortedQuotations, count: d.length };
      }
    },
    placeholderData: keepPreviousData
  });

  useEffect(() => {
    if (queryData) {
      setLocalQuotations(queryData.quotations);
    }
  }, [queryData]);

  const totalCount = queryData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotations").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      showToast("Cotización desactivada correctamente");
      queryClient.invalidateQueries({ queryKey: ['quotations_list'] });
    },
    onError: () => {
      showToast("Error al eliminar", "error");
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations_list'] });
    },
    onError: () => {
      showToast("Error al actualizar estado", "error");
    }
  });

  const duplicateMutation = useMutation({
    mutationFn: async (q: Quotation) => {
      const { data: items } = await supabase.from("quotation_items").select("*").eq("quotation_id", q.id);

      let number: string | null = null;
      const { data: rpcNumber, error: rpcError } = await supabase.rpc("generate_quotation_number");
      if (!rpcError && rpcNumber) {
        number = rpcNumber;
      } else {
        throw new Error("No se pudo generar el número de cotización. Reintentá en unos segundos.");
      }

      const { data: newQuot, error } = await supabase
        .from("quotations")
        .insert({
          number,
          user_id: q.user_id,
          client_name: q.client_name,
          client_ruc: q.client_ruc,
          client_address: q.client_address,
          client_phone: q.client_phone,
          client_email: q.client_email,
          subtotal: q.subtotal,
          igv_rate: q.igv_rate,
          igv: q.igv,
          total: q.total,
          notes: q.notes,
          validity_days: q.validity_days,
          status: "borrador",
        })
        .select()
        .single();

      if (error) throw error;

      if (newQuot && items?.length) {
        const { error: itemsError } = await supabase.from("quotation_items").insert(
          items.map((item: any, idx: number) => toQuotationItemRow(item, item.sort_order ?? idx, newQuot.id))
        );

        if (itemsError) {
          await supabase.from("quotations").delete().eq("id", newQuot.id);
          throw itemsError;
        }
      }
    },
    onSuccess: () => {
      showToast("Cotización duplicada como generada");
      queryClient.invalidateQueries({ queryKey: ['quotations_list'] });
    },
    onError: (e: any) => {
      showToast("Error al duplicar: " + e.message, "error");
    }
  });

  const createRevisionMutation = useMutation({
    mutationFn: async (q: Quotation) => {
      const { data: items } = await supabase.from("quotation_items").select("*").eq("quotation_id", q.id);
      const parentId = q.parent_id || q.id;

      const { data: existingRevisions } = await supabase
        .from("quotations")
        .select("revision")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: false })
        .limit(1);

      // Etiqueta en base 26: A..Z, AA, AB... `String.fromCharCode(charCode+1)`
      // producía '[' después de la Z y rompía el recorte del sufijo.
      const labelToIndex = (label: string): number =>
        label.split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
      const indexToLabel = (n: number): string => {
        let s = "", x = n;
        while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26); }
        return s || "A";
      };

      const prev = existingRevisions?.[0]?.revision || q.revision || null;
      const nextRevision = indexToLabel(prev ? labelToIndex(prev) + 1 : 1);

      const baseNumber = q.number.replace(/-[A-Z]{1,2}$/, "");
      const revisionNumber = `${baseNumber}-${nextRevision}`;

      const { data: newQuot, error } = await supabase
        .from("quotations")
        .insert({
          number: revisionNumber,
          user_id: q.user_id,
          client_name: q.client_name,
          client_ruc: q.client_ruc,
          client_address: q.client_address,
          client_phone: q.client_phone,
          client_email: q.client_email,
          subtotal: q.subtotal,
          igv_rate: q.igv_rate,
          igv: q.igv,
          total: q.total,
          notes: q.notes,
          validity_days: q.validity_days,
          status: "borrador",
          parent_id: parentId,
          revision: nextRevision,
        })
        .select()
        .single();

      if (error) throw error;

      if (newQuot && items?.length) {
        const { error: itemsError } = await supabase.from("quotation_items").insert(
          items.map((item: any, idx: number) => toQuotationItemRow(item, item.sort_order ?? idx, newQuot.id))
        );

        if (itemsError) {
          await supabase.from("quotations").delete().eq("id", newQuot.id);
          throw itemsError;
        }
      }
      return { nextRevision, revisionNumber };
    },
    onSuccess: (data) => {
      showToast(`Revisión ${data.nextRevision} creada: ${data.revisionNumber}`);
      queryClient.invalidateQueries({ queryKey: ['quotations_list'] });
    },
    onError: (e: any) => {
      showToast("Error al crear revisión: " + e.message, "error");
    }
  });

  async function handleDelete(id: string) {
    if (!confirm("¿Desactivar esta cotización? Pasará a un estado inactivo.")) return;
    deleteMutation.mutate(id);
  }

  async function handleStatusChange(id: string, newStatus: string) {
    statusMutation.mutate({ id, status: newStatus });
  }

  async function handleDuplicate(q: Quotation) {
    duplicateMutation.mutate(q);
  }

  async function handleCreateRevision(q: Quotation) {
    createRevisionMutation.mutate(q);
  }

  async function handleExportPDF(q: Quotation) {
    if (!settings) return;
    window.open(`/api/pdf/${q.id}`, "_blank");
    showToast("PDF generado");
  }

  async function handleExportExcel(q: Quotation) {
    if (!settings) return;
    const { data: items } = await supabase.from("quotation_items").select("*").eq("quotation_id", q.id).order("sort_order");
    const quotWithItems = { ...q, items: (items as any) || [] };
    const { generateExcel } = await import("@/lib/excel-export");
    generateExcel(quotWithItems, settings);
    showToast("Excel generado");
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Cotizaciones</h1>
          <p className="subtitle">{totalCount} cotizaciones encontradas</p>
        </div>
        <div className="page-header-actions" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", background: "var(--bg-tertiary)", padding: "4px", borderRadius: "var(--radius-md)", gap: "4px" }}>
            <button 
              className={`btn-icon ${viewMode === "table" ? "active" : ""}`} 
              onClick={() => { setViewMode("table"); localStorage.setItem("cotigrafic_view_mode", "table"); }}
              style={{ background: viewMode === "table" ? "var(--surface)" : "transparent", boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              title="Vista de Tabla"
            >
              <List size={16} />
            </button>
            <button 
              className={`btn-icon ${viewMode === "kanban" ? "active" : ""}`} 
              onClick={() => { setViewMode("kanban"); localStorage.setItem("cotigrafic_view_mode", "kanban"); }}
              style={{ background: viewMode === "kanban" ? "var(--surface)" : "transparent", boxShadow: viewMode === "kanban" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              title="Vista de Tablero"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <Link href="/dashboard/cotizaciones/nueva" className="btn btn-primary">
            <Plus size={18} />
            Nueva Cotización
          </Link>
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ marginBottom: "1rem", padding: "16px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 280 }}>
              <Search size={18} />
              <input
                type="text"
                placeholder="Buscar por cliente o N° cotización..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 180, padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--surface-border)", background: "var(--bg-primary)" }}
            >
              <option value="">Todos los estados</option>
              <option value="solicitada">Solicitudes Web</option>
              <option value="borrador">Generada</option>
              <option value="enviada">Enviada</option>
              <option value="aceptada">Aceptada</option>
              <option value="pagado">Pagada</option>
              <option value="rechazada">Rechazada</option>
              <option value="vencida">Vencida</option>
            </select>
            <button 
              className={`btn ${showFilters ? "btn-primary" : "btn-secondary"}`} 
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} /> Filtros Avanzados
            </button>
          </div>

          {showFilters && (
            <div style={{ 
              marginTop: "16px", paddingTop: "16px", 
              borderTop: "1px solid var(--surface-divider)", 
              display: "flex", gap: "16px", flexWrap: "wrap",
              animation: "fadeIn 0.2s ease" 
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-tertiary)", padding: "4px 8px", borderRadius: "var(--radius-md)" }}>
                <Calendar size={16} style={{ color: "var(--text-muted)" }} />
                <input 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => setDateFrom(e.target.value)} 
                  style={{ border: "none", background: "transparent", fontSize: "0.85rem", outline: "none", color: "var(--text-primary)" }}
                  title="Fecha de inicio"
                />
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>—</span>
                <input 
                  type="date" 
                  value={dateTo} 
                  onChange={(e) => setDateTo(e.target.value)} 
                  style={{ border: "none", background: "transparent", fontSize: "0.85rem", outline: "none", color: "var(--text-primary)" }}
                  title="Fecha de fin"
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-tertiary)", padding: "4px 8px", borderRadius: "var(--radius-md)", flex: 1, minWidth: 300 }}>
                <Package size={16} style={{ color: "var(--text-muted)" }} />
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                  style={{ border: "none", background: "transparent", fontSize: "0.85rem", outline: "none", color: "var(--text-primary)", fontWeight: 600, paddingRight: 4, borderRight: "1px solid var(--surface-divider)" }}
                >
                  <option value="">Todo tipo</option>
                  <option value="Producto">Producto</option>
                  <option value="Servicio">Servicio</option>
                  <option value="Material">Material</option>
                </select>
                <input 
                  type="text" 
                  value={itemSearch} 
                  onChange={(e) => setItemSearch(e.target.value)} 
                  placeholder="Contiene producto / material..."
                  style={{ border: "none", background: "transparent", fontSize: "0.85rem", outline: "none", color: "var(--text-primary)", flex: 1, paddingLeft: 8 }}
                />
              </div>

              {(dateFrom || dateTo || itemSearch || itemType) && (
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ color: "var(--error)" }}
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setItemSearch("");
                    setItemType("");
                  }}
                >
                  Limpiar Filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pipeline Summary Bar */}
        {!loading && localQuotations.length > 0 && (
          <div style={{ display: "flex", gap: "12px", marginBottom: "var(--space-lg)", flexWrap: "wrap" }}>
            {(["solicitada", "borrador", "enviada", "aceptada", "pagado", "rechazada", "vencida"] as const).map(status => {
              const statusQuots = localQuotations.filter(q => q.status === status);
              const statusTotal = statusQuots.reduce((sum, q) => sum + Number(q.total), 0);
              const color = getStatusColor(status);
              return (
                <div key={status} className="glass-card" style={{
                  flex: "1 1 140px",
                  padding: "12px 16px",
                  borderRadius: "var(--radius-md)",
                  background: `linear-gradient(to right, ${color}08, ${color}02)`,
                  borderLeft: `3px solid ${color}`,
                  minWidth: 0,
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}>
                  <div style={{ fontSize: "0.72rem", color: color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
                    {getStatusLabel(status)}
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {statusQuots.length}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {formatCurrency(statusTotal)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="card">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 8 }} />
            ))}
          </div>
        ) : catalogError ? (
          <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <ShieldAlert size={28} style={{ color: "var(--danger)", marginBottom: 8 }} />
            <h3>No pudimos cargar las cotizaciones</h3>
            <p className="subtitle" style={{ marginBottom: 12 }}>
              Puede ser una falla momentánea de conexión.
            </p>
            <button className="btn btn-secondary" onClick={() => refetchCatalog()}>
              Reintentar
            </button>
          </div>
        ) : localQuotations.length === 0 ? (
          <div className="card empty-state">
            <FileText size={48} />
            <h3>No se encontraron cotizaciones</h3>
            <p>
              {debouncedSearch || statusFilter
                ? "Prueba con otros filtros."
                : "Crea tu primera cotización para empezar."}
            </p>
            {!debouncedSearch && !statusFilter && (
              <Link href="/dashboard/cotizaciones/nueva" className="btn btn-primary">
                <Plus size={16} /> Nueva Cotización
              </Link>
            )}
          </div>
        ) : viewMode === "kanban" ? (
          <KanbanBoard 
            quotations={localQuotations}
            setQuotations={setLocalQuotations}
            onStatusChange={handleStatusChange}
            onDuplicate={handleDuplicate}
            onCreateRevision={handleCreateRevision}
            onExportPDF={handleExportPDF}
            onDelete={handleDelete}
          />
        ) : (
          <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>N° Cotización</th>
                  <th>Cliente</th>
                  <th>Subtotal</th>
                  <th>IGV</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {localQuotations.map((q) => {
                  const isWebRequest = q.status === "solicitada" || q.notes?.includes("[Solicitud Web");
                  const whatsappUrl = q.client_phone
                    ? generateAdminToClientWhatsAppUrl({
                        clientPhone: q.client_phone,
                        quotationNumber: q.number,
                        clientName: q.client_name,
                        total: q.total,
                      })
                    : null;

                  return (
                    <tr key={q.id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Link href={`/dashboard/cotizaciones/${q.id}`} style={{ color: "var(--accent)" }}>
                            {q.number}
                          </Link>
                          {isWebRequest && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                background: "rgba(245, 158, 11, 0.15)",
                                color: "#d97706",
                                padding: "1px 5px",
                                borderRadius: "var(--radius-sm)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 2,
                              }}
                              title="Solicitud generada por cliente desde la web"
                            >
                              <Globe size={10} /> Web
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="primary">{q.client_name}</td>
                      <td>{formatCurrency(Number(q.subtotal))}</td>
                      <td>{formatCurrency(Number(q.igv))}</td>
                      <td style={{ fontWeight: 600, color: "var(--success)" }}>
                        {formatCurrency(Number(q.total))}
                      </td>
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
                      <td>{formatDate(q.created_at)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          {whatsappUrl && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-icon"
                              title="Contactar al cliente por WhatsApp"
                              style={{ color: "#25D366" }}
                            >
                              <MessageCircle size={15} />
                            </a>
                          )}
                          <Link href={`/dashboard/cotizaciones/${q.id}`} className="btn-icon" title="Ver/Editar">
                            <Eye size={15} />
                          </Link>
                          <button className="btn-icon" title="Crear Revisión" onClick={() => handleCreateRevision(q)}>
                            <GitBranch size={15} />
                          </button>
                          <button className="btn-icon" title="Duplicar" onClick={() => handleDuplicate(q)}>
                            <Copy size={15} />
                          </button>
                          <button className="btn-icon" title="PDF" onClick={() => handleExportPDF(q)}>
                            <Download size={15} />
                          </button>
                          <button
                            className="btn-icon"
                            title="Eliminar"
                            onClick={() => handleDelete(q.id)}
                            style={{ color: "var(--error)" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderTop: "1px solid var(--surface-divider)",
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
            }}>
              <span>
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount} cotizaciones
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  ← Anterior
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 7) {
                    page = i + 1;
                  } else if (currentPage <= 4) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    page = totalPages - 6 + i;
                  } else {
                    page = currentPage - 3 + i;
                  }
                  return (
                    <button
                      key={page}
                      className={`btn btn-sm ${page === currentPage ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setCurrentPage(page)}
                      style={{ minWidth: 36 }}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
