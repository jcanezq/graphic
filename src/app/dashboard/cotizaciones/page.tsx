"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from "@/lib/formatters";
import { Search, Plus, FileText, Eye, Edit2, Trash2, Copy, Download, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import { generatePDF } from "@/lib/pdf-export";
import { generateExcel } from "@/lib/excel-export";
import { KanbanBoard } from "@/components/quotations/KanbanBoard";
import type { Quotation, CompanySettings } from "@/types";

export default function QuotationsPage() {
  const supabase = createClient();
  const { showToast } = useToast();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("kanban");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [quotRes, settingsRes] = await Promise.all([
      supabase.from("quotations").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("company_settings").select("*").limit(1).single(),
    ]);
    setQuotations((quotRes.data as Quotation[]) || []);
    setSettings(settingsRes.data as CompanySettings);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta cotización? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("quotations").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      showToast("Error al eliminar", "error");
    } else {
      showToast("Cotización eliminada");
      setQuotations((prev) => prev.filter((q) => q.id !== id));
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    const { error } = await supabase.from("quotations").update({ status: newStatus }).eq("id", id);
    if (error) {
      showToast("Error al actualizar estado", "error");
    }
  }

  async function handleDuplicate(q: Quotation) {
    // Get items
    const { data: items } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", q.id);

    // Get next number
    const { data: stg } = await supabase.from("company_settings").select("*").limit(1).single();
    const prefix = stg?.quotation_prefix || "COT";
    const nextNum = stg?.quotation_next_number || 1;
    const year = new Date().getFullYear();
    const number = `${prefix}-${year}-${String(nextNum).padStart(4, "0")}`;

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

    if (error) {
      showToast("Error al duplicar: " + error.message, "error");
      return;
    }

    if (newQuot && items?.length) {
      await supabase.from("quotation_items").insert(
        items.map((item: Record<string, unknown>) => ({
          quotation_id: newQuot.id,
          product_id: item.product_id,
          sort_order: item.sort_order,
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

    // Increment next number
    if (stg) {
      await supabase
        .from("company_settings")
        .update({ quotation_next_number: nextNum + 1 })
        .eq("id", stg.id);
    }

    showToast("Cotización duplicada como borrador");
    fetchData();
  }

  async function handleExportPDF(q: Quotation) {
    const { data: items } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", q.id)
      .order("sort_order");

    const quotWithItems = { ...q, items: items || [] };
    await generatePDF(quotWithItems, settings!);
    showToast("PDF generado");
  }

  async function handleExportExcel(q: Quotation) {
    const { data: items } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", q.id)
      .order("sort_order");

    const quotWithItems = { ...q, items: items || [] };
    generateExcel(quotWithItems, settings!);
    showToast("Excel generado");
  }

  const filtered = useMemo(() => {
    return quotations.filter((q) => {
      const matchesSearch =
        !search ||
        q.client_name.toLowerCase().includes(search.toLowerCase()) ||
        q.number.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !statusFilter || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotations, search, statusFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Cotizaciones</h1>
          <p className="subtitle">{quotations.length} cotizaciones en total</p>
        </div>
        <div className="page-header-actions" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", background: "var(--surface-sunken)", padding: "4px", borderRadius: "var(--radius-md)", gap: "4px" }}>
            <button 
              className={`btn-icon ${viewMode === "table" ? "active" : ""}`} 
              onClick={() => setViewMode("table")}
              style={{ background: viewMode === "table" ? "var(--surface)" : "transparent", boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              title="Vista de Tabla"
            >
              <List size={16} />
            </button>
            <button 
              className={`btn-icon ${viewMode === "kanban" ? "active" : ""}`} 
              onClick={() => setViewMode("kanban")}
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
        <div className="toolbar">
          <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
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
            style={{ width: 180 }}
          >
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="enviada">Enviada</option>
            <option value="aceptada">Aceptada</option>
            <option value="rechazada">Rechazada</option>
            <option value="vencida">Vencida</option>
          </select>
        </div>

        {loading ? (
          <div className="card">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 8 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <FileText size={48} />
            <h3>No se encontraron cotizaciones</h3>
            <p>
              {search || statusFilter
                ? "Prueba con otros filtros."
                : "Crea tu primera cotización para empezar."}
            </p>
            {!search && !statusFilter && (
              <Link href="/dashboard/cotizaciones/nueva" className="btn btn-primary">
                <Plus size={16} /> Nueva Cotización
              </Link>
            )}
          </div>
        ) : viewMode === "kanban" ? (
          <KanbanBoard 
            quotations={filtered}
            setQuotations={setQuotations}
            onStatusChange={handleStatusChange}
            onDuplicate={handleDuplicate}
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
                {paginated.map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                      <Link href={`/dashboard/cotizaciones/${q.id}`} style={{ color: "var(--accent)" }}>
                        {q.number}
                      </Link>
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
                        <Link href={`/dashboard/cotizaciones/${q.id}`} className="btn-icon" title="Ver/Editar">
                          <Eye size={15} />
                        </Link>
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
                ))}
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
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} cotizaciones
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
