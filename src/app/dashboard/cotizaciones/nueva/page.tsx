"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency } from "@/lib/formatters";
import {
  createQuotationItemFromProduct,
  recalcQuotationItem,
  calcQuotationTotals,
} from "@/lib/calculations";
import { Save, ArrowLeft, Plus, Trash2, Search } from "lucide-react";
import Link from "next/link";

import { fetchRucData } from "@/lib/ruc";
import type { Product, QuotationItem, CompanySettings } from "@/types";

export default function NewQuotationPage() {
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

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
  const [productFilter, setProductFilter] = useState<"Todos" | "Producto" | "Servicio" | "Material">("Todos");
  const [categoryFilter, setCategoryFilter] = useState("Todas");

  // Client autocomplete
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [searchingRuc, setSearchingRuc] = useState(false);

  const { data: initialData, isLoading } = useQuery({
    queryKey: ['quotation_form_data'],
    queryFn: async () => {
      const [settingsRes, productsRes, clientsRes, categoriesRes] = await Promise.all([
        supabase.from("company_settings").select("*").limit(1).single(),
        supabase.from("products").select("*").eq("is_active", true).order("name"),
        supabase.from("clients").select("*").order("name"),
        supabase.from("categories").select("*").is("deleted_at", null).order("name"),
      ]);

      const stg = settingsRes.data as CompanySettings;
      let prods: Product[] = [];
      
      if (productsRes.data && productsRes.data.length > 0) {
        const ids = productsRes.data.map((p: any) => p.id);
        const [matRes, labRes, indRes] = await Promise.all([
          supabase.from("product_materials").select("*, materials(id, cost, name, unit)").in("product_id", ids),
          supabase.from("product_labor").select("*").in("product_id", ids),
          supabase.from("product_indirect_costs").select("*").in("product_id", ids),
        ]);

        prods = productsRes.data.map((p: any) => {
          const materials = (matRes.data || [])
            .filter((m: any) => m.product_id === p.id)
            .map((m: any) => ({
               ...m,
               unit_cost: m.materials?.cost ?? m.unit_cost,
               name: m.materials?.name ?? m.name,
               unit: m.materials?.unit ?? m.unit
            }));
          return {
            ...p,
            materials,
            labor: (labRes.data || []).filter((l: any) => l.product_id === p.id),
            indirect_costs: (indRes.data || []).filter((ic: any) => ic.product_id === p.id),
          };
        });
      }

      return {
        settings: stg,
        products: prods,
        clients: (clientsRes.data || []) as any[],
        categories: (categoriesRes.data || []) as any[]
      };
    }
  });

  const settings = initialData?.settings || null;
  const products = initialData?.products || [];
  const clients = initialData?.clients || [];
  const categories = initialData?.categories || [];

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
      has_labor: changes.has_labor,
      has_design: changes.has_design,
      has_transport: changes.has_transport,
    });
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const igvRate = settings?.igv_rate ?? 0.18;
  const totals = calcQuotationTotals(items, igvRate);

  const filteredProducts = products.filter(
    (p) => {
      const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase());
      const matchesFilter = productFilter === "Todos" || p.type === productFilter;
      const matchesCategory = categoryFilter === "Todas" || p.category_id === categoryFilter;
      return matchesSearch && matchesFilter && matchesCategory;
    }
  );

  const saveMutation = useMutation({
    mutationFn: async (exportPdf: boolean) => {
      const errors: string[] = [];

      if (!clientName.trim()) errors.push("Nombre del cliente es obligatorio");
      if (clientRuc && !/^\d{11}$/.test(clientRuc.replace(/\s/g, ""))) errors.push("RUC debe tener exactamente 11 dígitos");
      if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) errors.push("Email no tiene formato válido");
      if (items.length === 0) errors.push("Agrega al menos un producto");

      if (errors.length > 0) {
        throw new Error(errors.join(" · "));
      }

      const { error: clientError } = await supabase.from("clients").upsert(
        {
          name: clientName.trim(),
          ruc: clientRuc || null,
          address: clientAddress || null,
          phone: clientPhone || null,
          email: clientEmail || null,
        },
        { onConflict: "name" }
      );

      if (clientError) {
        console.error("Error upserting client:", clientError);
        throw new Error("No se pudo guardar el cliente (¿falta crear la tabla?): " + clientError.message);
      }

      let number: string | null = null;
      const { data: rpcNumber, error: rpcError } = await supabase.rpc("generate_quotation_number");
      
      if (!rpcError && rpcNumber) {
        number = rpcNumber;
      } else {
        const { data: settingsData } = await supabase
          .from("company_settings")
          .select("id, quotation_prefix, quotation_next_number")
          .limit(1)
          .single();

        const prefix = settingsData?.quotation_prefix || "COT";
        const nextNum = settingsData?.quotation_next_number || 1;
        const year = new Date().getFullYear();
        number = `${prefix}-${year}-${String(nextNum).padStart(4, "0")}`;

        if (settingsData?.id) {
          await supabase
            .from("company_settings")
            .update({ quotation_next_number: nextNum + 1 })
            .eq("id", settingsData.id);
        }
      }

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

      if (error) throw new Error(error.message);

      if (quotation) {
        const finalItems = [...items];
        
        for (let i = 0; i < finalItems.length; i++) {
          const item = finalItems[i];
          if (item.has_design === false && item.client_design_file) {
            const file = item.client_design_file;
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${user!.id}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('client-designs')
              .upload(filePath, file);
              
            if (uploadError) {
               await supabase.from("quotations").delete().eq("id", quotation.id);
               throw new Error(`Error subiendo diseño para ${item.product_name}: ` + uploadError.message);
            }
            
            const { data: { publicUrl } } = supabase.storage
              .from('client-designs')
              .getPublicUrl(filePath);
              
            item.client_design_url = publicUrl;
          }
        }

        const { error: itemsError } = await supabase.from("quotation_items").insert(
          finalItems.map((item, idx) => ({
            quotation_id: quotation.id,
            product_id: item.product_id || null,
            item_type: item.item_type || 'Producto',
            has_labor: item.has_labor ?? true,
            has_design: item.has_design ?? true,
            design_cost: item.design_cost || 0,
            has_transport: item.has_transport ?? true,
            transport_cost: item.transport_cost || 0,
            client_design_url: item.client_design_url || null,
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
          await supabase.from("quotations").delete().eq("id", quotation.id);
          throw new Error("Error guardando ítems: " + itemsError.message);
        }
      }

      return { quotation, number, exportPdf };
    },
    onSuccess: (data) => {
      showToast("Cotización " + data.number + " creada exitosamente");
      if (data.exportPdf && data.quotation) {
        window.open(`/api/pdf/${data.quotation.id}`, "_blank");
      }
      queryClient.invalidateQueries({ queryKey: ['quotations_list'] });
      router.push("/dashboard/cotizaciones");
    },
    onError: (error: any) => {
      showToast(error.message, "error");
    }
  });

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
                  <label>RUC</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      value={clientRuc}
                      onChange={(e) => setClientRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
                      placeholder="20123456789"
                      maxLength={11}
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
                <div className="form-group" style={{ position: "relative" }}>
                  <label>Nombre / Razón Social *</label>
                  <input
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      setShowClientDropdown(e.target.value.length >= 2);
                    }}
                    onFocus={() => clientName.length >= 2 && setShowClientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                    placeholder="Buscar o escribir nombre..."
                    required
                  />
                  {showClientDropdown && (() => {
                    const matches = clients.filter((c) =>
                      c.name.toLowerCase().includes(clientName.toLowerCase())
                    ).slice(0, 5);
                    if (matches.length === 0) return null;
                    return (
                      <div style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--surface-border)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-lg)",
                        zIndex: 50,
                        maxHeight: 200,
                        overflowY: "auto",
                      }}>
                        {matches.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              padding: "8px 12px",
                              cursor: "pointer",
                              borderBottom: "1px solid var(--surface-divider)",
                              fontSize: "0.85rem",
                            }}
                            onMouseDown={() => {
                              setClientName(c.name);
                              setClientRuc(c.ruc || "");
                              setClientAddress(c.address || "");
                              setClientPhone(c.phone || "");
                              setClientEmail(c.email || "");
                              setShowClientDropdown(false);
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            {c.ruc && (
                              <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                                RUC: {c.ruc}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
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
              <div style={{ display: "flex", gap: 8, marginBottom: "var(--space-sm)", overflowX: "auto", paddingBottom: 4, alignItems: "center" }}>
                {(["Todos", "Producto", "Servicio", "Material"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`btn ${productFilter === type ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: "4px 12px", fontSize: "0.8rem", borderRadius: "16px", whiteSpace: "nowrap" }}
                    onClick={() => {
                      setProductFilter(type);
                      setShowProductDropdown(true);
                      if (type === "Servicio" || type === "Material") {
                        setCategoryFilter("Todas");
                      }
                    }}
                  >
                    {type === "Todos" ? "Todos" : type === "Material" ? "Materiales" : type + "s"}
                  </button>
                ))}
                
                <div style={{ width: "1px", height: "24px", background: "var(--surface-divider)", margin: "0 4px" }} />
                
                <select
                  className="input"
                  style={{ padding: "4px 12px", fontSize: "0.8rem", borderRadius: "16px", height: "auto", minWidth: "150px" }}
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setShowProductDropdown(true);
                  }}
                >
                  <option value="Todas">Todas las Categorías</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
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
                {showProductDropdown && (
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
                                    Sube el diseño del cliente:
                                  </span>
                                  <input 
                                    type="file" 
                                    accept="image/*,.pdf,.ai,.psd" 
                                    style={{ fontSize: '0.7rem', width: '100%' }} 
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      const updated = [...items];
                                      updated[i].client_design_file = file;
                                      setItems(updated);
                                    }} 
                                  />
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
                  disabled={saveMutation.isPending || isLoading}
                  onClick={() => saveMutation.mutate(false)}
                  style={{ width: "100%" }}
                >
                  <Save size={16} />
                  {saveMutation.isPending ? "Guardando..." : "Guardar Cotización"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
