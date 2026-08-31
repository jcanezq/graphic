"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency } from "@/lib/formatters";
import {
  createQuotationItemFromProduct,
  recalcQuotationItem,
  calcQuotationTotals,
} from "@/lib/calculations";
import { Save, ArrowLeft, Plus, Trash2, Search, FileDown } from "lucide-react";
import Link from "next/link";
import { generatePDF } from "@/lib/pdf-export";
import type { Product, QuotationItem, Category, CompanySettings } from "@/types";

export default function NewQuotationPage() {
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Client data
  const [clientName, setClientName] = useState("");
  const [clientRuc, setClientRuc] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [validityDays, setValidityDays] = useState(15);

  // Items
  const [items, setItems] = useState<QuotationItem[]>([]);

  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    const [settingsRes, productsRes, catRes] = await Promise.all([
      supabase.from("company_settings").select("*").limit(1).single(),
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);

    const stg = settingsRes.data as CompanySettings;
    setSettings(stg);
    if (stg) setValidityDays(15);
    setCategories((catRes.data as Category[]) || []);

    // Load products with costs
    if (productsRes.data) {
      const ids = productsRes.data.map((p: { id: string }) => p.id);
      const [matRes, labRes, indRes] = await Promise.all([
        supabase.from("product_materials").select("*").in("product_id", ids),
        supabase.from("product_labor").select("*").in("product_id", ids),
        supabase.from("product_indirect_costs").select("*").in("product_id", ids),
      ]);

      const prods = productsRes.data.map((p: Record<string, unknown>) => ({
        ...p,
        materials: (matRes.data || []).filter((m: { product_id: string }) => m.product_id === p.id),
        labor: (labRes.data || []).filter((l: { product_id: string }) => l.product_id === p.id),
        indirect_costs: (indRes.data || []).filter((ic: { product_id: string }) => ic.product_id === p.id),
      }));

      setProducts(prods as Product[]);
    }
  }

  function addProduct(product: Product) {
    const margin = settings?.default_margin ?? product.default_margin ?? 30;
    const newItem = createQuotationItemFromProduct(product, 1, margin, items.length);
    setItems([...items, newItem]);
    setProductSearch("");
    setShowProductDropdown(false);
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

  const igvRate = settings?.igv_rate ?? 0.18;
  const totals = calcQuotationTotals(items, igvRate);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(productSearch.toLowerCase())
  );

  async function handleSave(exportPdf = false) {
    if (!clientName.trim()) {
      showToast("Nombre del cliente es obligatorio", "error");
      return;
    }
    if (items.length === 0) {
      showToast("Agrega al menos un producto", "error");
      return;
    }

    setSaving(true);

    // Atomic quotation number generation (prevents race condition)
    const { data: number, error: rpcError } = await supabase.rpc("generate_quotation_number");
    if (rpcError || !number) {
      showToast("Error generando número: " + (rpcError?.message || "sin respuesta"), "error");
      setSaving(false);
      return;
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    const { data: quotation, error } = await supabase
      .from("quotations")
      .insert({
        number,
        user_id: user!.id,
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
        status: "borrador",
      })
      .select()
      .single();

    if (error) {
      showToast("Error: " + error.message, "error");
      setSaving(false);
      return;
    }

    // Insert items
    if (quotation) {
      const { error: itemsError } = await supabase.from("quotation_items").insert(
        items.map((item, idx) => ({
          quotation_id: quotation.id,
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

      if (itemsError) {
        // Rollback: delete the quotation without items
        await supabase.from("quotations").delete().eq("id", quotation.id);
        showToast("Error guardando ítems: " + itemsError.message, "error");
        setSaving(false);
        return;
      }

      if (exportPdf && settings) {
        generatePDF({ ...quotation, items } as never, settings);
      }
    }

    showToast("Cotización " + number + " creada exitosamente");
    setSaving(false);
    router.push("/dashboard/cotizaciones");
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/dashboard/cotizaciones" className="btn-icon">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1>Nueva Cotización</h1>
            <p className="subtitle">Completa los datos del cliente y agrega productos</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="content-grid">
          {/* Left Column */}
          <div>
            {/* Client Info */}
            <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
              <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
                👤 Datos del Cliente
              </h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre / Razón Social *</label>
                  <input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Empresa SAC"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>RUC</label>
                  <input
                    value={clientRuc}
                    onChange={(e) => setClientRuc(e.target.value)}
                    placeholder="20123456789"
                    maxLength={11}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <input
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Av. Ejemplo 123, Lima"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="999 888 777"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="cliente@empresa.com"
                  />
                </div>
              </div>
            </div>

            {/* Product Search */}
            <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
              <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
                📦 Agregar Productos
              </h3>
              <div style={{ position: "relative" }}>
                <div className="search-bar" style={{ maxWidth: "100%" }}>
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Buscar producto por nombre o código..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                  />
                </div>
                {showProductDropdown && productSearch && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      maxHeight: 240,
                      overflowY: "auto",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--surface-border)",
                      borderRadius: "var(--radius-md)",
                      marginTop: 4,
                      zIndex: 50,
                      boxShadow: "var(--shadow-lg)",
                    }}
                  >
                    {filteredProducts.length === 0 ? (
                      <div style={{ padding: 16, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        No se encontraron productos
                      </div>
                    ) : (
                      filteredProducts.slice(0, 10).map((p) => (
                        <div
                          key={p.id}
                          onClick={() => addProduct(p)}
                          style={{
                            padding: "10px 16px",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: "1px solid var(--surface-divider)",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "var(--bg-glass)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <div>
                            <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>{p.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {p.code} · {p.unit}
                            </div>
                          </div>
                          <Plus size={16} style={{ color: "var(--accent)" }} />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
                📋 Ítems de la Cotización ({items.length})
              </h3>
              {items.length === 0 ? (
                <div className="empty-state" style={{ padding: "2rem" }}>
                  <p style={{ color: "var(--text-muted)" }}>
                    Usa el buscador de arriba para agregar productos a esta cotización.
                  </p>
                </div>
              ) : (
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
                          <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{i + 1}</td>
                          <td className="primary" style={{ fontSize: "0.82rem" }}>
                            <div>{item.product_name}</div>
                            {item.product_code && (
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                {item.product_code}
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
                              max={200}
                              value={item.margin_percent}
                              onChange={(e) =>
                                updateItem(i, { margin_percent: Number(e.target.value) })
                              }
                              style={{ width: 70 }}
                            />
                          </td>
                          <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                            {formatCurrency(item.unit_price)}
                          </td>
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
                  <label>Validez (días)</label>
                  <input
                    type="number"
                    min={1}
                    value={validityDays}
                    onChange={(e) => setValidityDays(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Observaciones / Notas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Condiciones de pago, notas adicionales..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Right Column — Totals */}
          <div>
            <div className="cost-breakdown" style={{ position: "sticky", top: 90 }}>
              <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
                Resumen
              </h3>
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

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "var(--space-lg)" }}>
                <button
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => handleSave(false)}
                  style={{ width: "100%" }}
                >
                  <Save size={16} />
                  {saving ? "Guardando..." : "Guardar Borrador"}
                </button>
                <button
                  className="btn-secondary"
                  disabled={saving}
                  onClick={() => handleSave(true)}
                  style={{ width: "100%" }}
                >
                  <FileDown size={16} />
                  Guardar y Exportar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
