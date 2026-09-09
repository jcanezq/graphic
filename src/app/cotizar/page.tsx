"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, normalizeText } from "@/lib/formatters";
import { fetchRucData } from "@/lib/ruc";
import type { PublicProduct } from "@/types";
import {
  Calculator,
  Plus,
  Trash2,
  Search,
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  Send,
  MessageCircle,
  LogIn,
  Layers,
  FileText,
  User,
  Sparkles,
} from "lucide-react";

interface DraftItem {
  product_id: string;
  product_name: string;
  product_code: string;
  product_type: string;
  unit: string;
  base_unit_price: number;
  unit_price: number;
  quantity: number;
  has_labor?: boolean;
  has_design?: boolean;
  has_transport?: boolean;
  labor_price?: number;
  design_price?: number;
  transport_price?: number;
  material_price?: number;
  other_price?: number;
}

export default function CotizadorPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());

  // Current session
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Draft items in quotation
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loadingDraft, setLoadingDraft] = useState(true);

  // Client details
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientRuc, setClientRuc] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [searchingRuc, setSearchingRuc] = useState(false);

  // Product selector dropdown
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Submission & Auth Modal state
  const [submitting, setSubmitting] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [completedQuote, setCompletedQuote] = useState<{
    quotationId: string;
    number: string;
    total: number;
    whatsappUrl: string;
  } | null>(null);

  // Load catalog
  const { data: catalogData } = useQuery({
    queryKey: ["public_products"],
    queryFn: async () => {
      const res = await fetch("/api/public/products");
      if (!res.ok) throw new Error("Error cargando productos");
      return res.json() as Promise<{
        products: PublicProduct[];
        settings: { company_name: string; phone: string; igv_rate: number };
      }>;
    },
  });

  const products = catalogData?.products || [];
  const igvRate = catalogData?.settings?.igv_rate ?? 0.18;

  // 1. Initialize user & restore items from localStorage
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        setClientName(user.user_metadata?.full_name || user.email?.split("@")[0] || "");
        setClientEmail(user.email || "");
      }

      try {
        const savedDraft = localStorage.getItem("cotigrafic_quote_items");
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        }

        const savedForm = localStorage.getItem("cotigrafic_quote_form");
        if (savedForm) {
          const parsed = JSON.parse(savedForm);
          if (parsed.clientName && !user) setClientName(parsed.clientName);
          if (parsed.clientPhone) setClientPhone(parsed.clientPhone);
          if (parsed.clientRuc) setClientRuc(parsed.clientRuc);
          if (parsed.clientAddress) setClientAddress(parsed.clientAddress);
          if (parsed.notes) setNotes(parsed.notes);
        }
      } catch (e) {
        console.error("Error restoring draft:", e);
      } finally {
        setLoadingDraft(false);
      }
    }
    init();
  }, [supabase]);

  // Sync items to localStorage
  function persistItems(newItems: DraftItem[]) {
    setItems(newItems);
    localStorage.setItem("cotigrafic_quote_items", JSON.stringify(newItems));
    window.dispatchEvent(new Event("cotigrafic_cart_updated"));
  }

  function handleQuantityChange(index: number, val: number) {
    const qty = Math.max(1, val);
    const updated = [...items];
    updated[index].quantity = qty;
    persistItems(updated);
  }

  function handleRemoveItem(index: number) {
    const updated = items.filter((_, i) => i !== index);
    persistItems(updated);
    showToast("Ítem eliminado");
  }

  function handleToggleServiceOption(index: number, option: 'labor' | 'design' | 'transport', value: boolean) {
    const updated = [...items];
    const item = updated[index];
    
    if (option === 'labor') item.has_labor = value;
    if (option === 'design') item.has_design = value;
    if (option === 'transport') item.has_transport = value;
    
    // Recalculate unit_price
    let newPrice = item.base_unit_price;
    if (item.has_labor === false && item.labor_price) newPrice -= item.labor_price;
    if (item.has_design === false && item.design_price) newPrice -= item.design_price;
    if (item.has_transport === false && item.transport_price) newPrice -= item.transport_price;
    
    item.unit_price = Math.max(0, newPrice);
    
    persistItems(updated);
  }

  function handleAddItem(product: PublicProduct) {
    const existingIndex = items.findIndex((it) => it.product_id === product.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      persistItems(updated);
    } else {
      const newItem: DraftItem = {
        product_id: product.id,
        product_name: product.name,
        product_code: product.code,
        product_type: product.type,
        unit: product.unit,
        base_unit_price: product.unit_price,
        unit_price: product.unit_price,
        quantity: 1,
        has_labor: true,
        has_design: true,
        has_transport: true,
        labor_price: product.labor_price,
        design_price: product.design_price,
        transport_price: product.transport_price,
        material_price: product.material_price,
        other_price: product.other_price,
      };
      persistItems([...items, newItem]);
    }
    setProductSearch("");
    setShowProductDropdown(false);
    showToast(`"${product.name}" añadido`);
  }

  async function handleSearchRuc() {
    if (clientRuc.length !== 11) return;
    try {
      setSearchingRuc(true);
      const data = await fetchRucData(clientRuc);
      setClientName(data.razonSocial);
      setClientAddress(data.direccion);
      showToast("Datos de RUC obtenidos");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSearchingRuc(false);
    }
  }

  // Calculate totals
  const subtotal = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
  const igv = subtotal * igvRate;
  const total = subtotal + igv;

  // Filter products for dropdown
  const normalizedProductSearch = normalizeText(productSearch);
  const searchTokens = normalizedProductSearch.split(/\s+/).filter(Boolean);

  const filteredProducts = products.filter((p) => {
    if (searchTokens.length === 0) return true;
    const targetText = normalizeText(`${p.name} ${p.code} ${p.description || ""} ${p.category_name || ""}`);
    return searchTokens.every((token) => targetText.includes(token));
  });

  // Trigger Google Login
  async function handleGoogleLogin() {
    // Save current form state before redirecting
    localStorage.setItem(
      "cotigrafic_quote_form",
      JSON.stringify({ clientName, clientPhone, clientRuc, clientAddress, notes })
    );
    localStorage.setItem("cotigrafic_auth_redirect", "/cotizar");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      showToast(error.message || "Error al conectar con Google", "error");
    }
  }

  // Submit quote
  async function handleGenerateQuote() {
    if (items.length === 0) {
      showToast("Agrega al menos un producto a tu cotización", "error");
      return;
    }

    if (!clientName.trim()) {
      showToast("Por favor ingresa tu nombre o razón social", "error");
      return;
    }

    if (!clientPhone.trim()) {
      showToast("Por favor ingresa tu número de WhatsApp para confirmación", "error");
      return;
    }

    // If user is not authenticated, request Google login modal
    if (!currentUser) {
      setShowGoogleModal(true);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/client/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName.trim(),
          client_phone: clientPhone.trim(),
          client_email: clientEmail.trim() || currentUser.email,
          client_ruc: clientRuc.trim() || null,
          client_address: clientAddress.trim() || null,
          notes: notes.trim() || null,
          items: items.map((it) => ({
            product_id: it.product_id,
            quantity: it.quantity,
            has_labor: it.has_labor ?? true,
            has_design: it.has_design ?? true,
            has_transport: it.has_transport ?? true,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al procesar la cotización");
      }

      // Success!
      localStorage.removeItem("cotigrafic_quote_items");
      localStorage.removeItem("cotigrafic_quote_form");
      window.dispatchEvent(new Event("cotigrafic_cart_updated"));

      setCompletedQuote({
        quotationId: data.quotationId,
        number: data.number,
        total: data.total,
        whatsappUrl: data.whatsappUrl,
      });

      showToast("¡Cotización generada exitosamente!");
    } catch (err: any) {
      console.error(err);
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
      <PublicNavbar />

      <main style={{ maxWidth: "1240px", margin: "0 auto", padding: "2.5rem 1.5rem", width: "100%", flex: 1 }}>
        {/* If Quote Completed View */}
        {completedQuote ? (
          <div
            style={{
              maxWidth: "680px",
              margin: "2rem auto",
              background: "var(--bg-secondary)",
              border: "1px solid var(--surface-border)",
              borderRadius: "var(--radius-xl)",
              padding: "3rem 2rem",
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
              {completedQuote.number}
            </div>

            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              ¡Tu cotización ha sido generada!
            </h1>

            <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.5, marginBottom: "1.75rem" }}>
              Hemos registrado tu solicitud por un total preliminar de{" "}
              <strong style={{ color: "var(--text-primary)", fontSize: "1.15rem" }}>
                {formatCurrency(completedQuote.total)}
              </strong>
              . Para coordinar los detalles técnicos y validar las medidas, confirma con nuestro asesor:
            </p>

            {/* BIG WHATSAPP ACTION BUTTON */}
            <a
              href={completedQuote.whatsappUrl}
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
                marginBottom: "1.25rem",
                transition: "transform 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <MessageCircle size={24} />
              <span>Confirmar por WhatsApp con un Asesor</span>
            </a>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "1rem",
                flexWrap: "wrap",
                borderTop: "1px solid var(--surface-divider)",
                paddingTop: "1.5rem",
                marginTop: "1.5rem",
              }}
            >
              <Link
                href="/mis-cotizaciones"
                prefetch={false}
                className="btn btn-secondary"
                style={{ fontSize: "0.9rem", padding: "0.65rem 1.25rem" }}
              >
                <FileText size={16} />
                <span>Ver en Mis Cotizaciones</span>
              </Link>

              <button
                onClick={() => {
                  setCompletedQuote(null);
                  setItems([]);
                }}
                className="btn btn-ghost"
                style={{ fontSize: "0.9rem", padding: "0.65rem 1.25rem" }}
              >
                + Crear otra cotización
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <Link
                  href="/"
                  prefetch={false}
                  style={{
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    fontSize: "0.85rem",
                    textDecoration: "none",
                  }}
                >
                  <ArrowLeft size={15} />
                  <span>Volver al Catálogo</span>
                </Link>
              </div>

              <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Cotizador Interactivo
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                Arma tu presupuesto en tiempo real. Precios referenciales sujetos a confirmación técnica.
              </p>
            </div>

            {/* Content Layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "2rem", alignItems: "start" }}>
              {/* Left Column: Items and Selection */}
              <div>
                {/* Product Search & Add Bar */}
                <div
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "1.25rem",
                    marginBottom: "1.5rem",
                    boxShadow: "var(--shadow-sm)",
                    position: "relative",
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Agregar producto o servicio a tu cotización:
                  </label>

                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.65rem",
                        border: "1px solid var(--surface-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "0.65rem 1rem",
                        background: "var(--bg-primary)",
                      }}
                    >
                      <Search size={18} color="var(--text-muted)" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setShowProductDropdown(true);
                        }}
                        onFocus={() => setShowProductDropdown(true)}
                        placeholder="Escribe el nombre o código del producto..."
                        style={{
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: "0.95rem",
                          width: "100%",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>

                    {/* Autocomplete Dropdown */}
                    {showProductDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: "0.35rem",
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--surface-border)",
                          borderRadius: "var(--radius-md)",
                          boxShadow: "var(--shadow-lg)",
                          maxHeight: "260px",
                          overflowY: "auto",
                          zIndex: 40,
                        }}
                      >
                        {filteredProducts.length === 0 ? (
                          <div style={{ padding: "0.85rem 1rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                            No se encontraron coincidencias
                          </div>
                        ) : (
                          filteredProducts.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => handleAddItem(p)}
                              style={{
                                padding: "0.75rem 1rem",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                cursor: "pointer",
                                borderBottom: "1px solid var(--surface-divider)",
                                transition: "background 0.15s ease",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>
                                  {p.name}
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                  {p.type} · Cód: {p.code} · Por {p.unit}
                                </div>
                              </div>
                              <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.95rem" }}>
                                {formatCurrency(p.unit_price)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Table / Cards */}
                <div
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "var(--radius-lg)",
                    overflow: "hidden",
                    boxShadow: "var(--shadow-sm)",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div
                    style={{
                      padding: "1rem 1.25rem",
                      borderBottom: "1px solid var(--surface-divider)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      Ítems seleccionados ({items.length})
                    </h2>
                    {items.length > 0 && (
                      <button
                        onClick={() => persistItems([])}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--error)",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Vaciar lista
                      </button>
                    )}
                  </div>

                  {items.length === 0 ? (
                    <div style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: "50%",
                          background: "var(--bg-tertiary)",
                          color: "var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "0 auto 1rem auto",
                        }}
                      >
                        <Layers size={24} />
                      </div>
                      <p style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: "1rem" }}>
                        Tu cotización aún está vacía
                      </p>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                        Busca arriba un producto o servicio para agregarlo y ver su precio estimado.
                      </p>
                    </div>
                  ) : (
                    <div>
                      {items.map((item, idx) => (
                        <div
                          key={item.product_id + idx}
                          style={{
                            padding: "1rem 1.25rem",
                            borderBottom: idx < items.length - 1 ? "1px solid var(--surface-divider)" : "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "1rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: "200px" }}>
                              <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                                {item.product_name}
                              </div>
                              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                Cód: {item.product_code}
                              </div>
                            </div>
                            
                            {/* P.V. Unit */}
                            <div style={{ width: "100px", textAlign: "right" }}>
                              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>P.V. Unit</span>
                              <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                                {formatCurrency(item.base_unit_price)}
                              </span>
                            </div>

                            {/* Quantity control */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100px" }}>
                              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Cant.</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                                  style={{
                                    width: "60px", padding: "0.3rem", border: "1px solid var(--surface-border)",
                                    borderRadius: "var(--radius-sm)", fontSize: "0.9rem", fontWeight: 600, textAlign: "center",
                                  }}
                                />
                                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{item.unit}</span>
                              </div>
                            </div>

                            {/* Subtotal */}
                            <div style={{ textAlign: "right", minWidth: "90px" }}>
                              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Subtotal</span>
                              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                {formatCurrency(item.quantity * item.base_unit_price)}
                              </div>
                            </div>

                            {/* Delete */}
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0.4rem", marginTop: 14 }}
                              title="Eliminar ítem"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Components Rows */}
                          {item.product_type === 'Servicio' && (
                            <div style={{ 
                              marginLeft: "1rem", 
                              padding: "0.75rem 1rem", 
                              background: "var(--bg-primary)", 
                              borderRadius: "var(--radius-md)", 
                              border: "1px solid var(--surface-divider)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.65rem"
                            }}>
                              {/* Component Header */}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", paddingBottom: "0.4rem", borderBottom: "1px solid var(--surface-divider)", fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                <div style={{ flex: 1, minWidth: "180px" }}>Componente Opcional</div>
                                <div style={{ width: "90px", textAlign: "right" }}>P.V. Unit</div>
                                <div style={{ width: "90px", textAlign: "center" }}>Cant.</div>
                                <div style={{ minWidth: "90px", textAlign: "right" }}>Subtotal</div>
                                <div style={{ width: "32px" }}></div>
                              </div>

                              {/* Labor Row */}
                              {item.labor_price !== undefined && item.labor_price > 0 && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", opacity: item.has_labor ? 1 : 0.5, transition: "opacity 0.2s" }}>
                                  <div style={{ flex: 1, minWidth: "180px" }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>
                                      <input 
                                        type="checkbox" 
                                        checked={item.has_labor ?? true} 
                                        onChange={(e) => handleToggleServiceOption(idx, 'labor', e.target.checked)}
                                        style={{ width: 'auto', margin: 0 }}
                                      /> 
                                      Mano de Obra
                                    </label>
                                  </div>
                                  <div style={{ width: "90px", textAlign: "right", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                    {formatCurrency(item.labor_price)}
                                  </div>
                                  <div style={{ width: "90px", textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                    1 hr
                                  </div>
                                  <div style={{ minWidth: "90px", textAlign: "right", fontSize: "0.9rem", fontWeight: 600, color: item.has_labor ? "var(--success)" : "var(--text-muted)" }}>
                                    {formatCurrency(item.has_labor ? item.labor_price : 0)}
                                  </div>
                                  <div style={{ width: "32px" }}></div>
                                </div>
                              )}
                              
                              {/* Design Row */}
                              {item.design_price !== undefined && item.design_price > 0 && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", opacity: item.has_design ? 1 : 0.5, transition: "opacity 0.2s" }}>
                                  <div style={{ flex: 1, minWidth: "180px" }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>
                                      <input 
                                        type="checkbox" 
                                        checked={item.has_design ?? true} 
                                        onChange={(e) => handleToggleServiceOption(idx, 'design', e.target.checked)}
                                        style={{ width: 'auto', margin: 0 }}
                                      /> 
                                      Diseño Gráfico
                                    </label>
                                  </div>
                                  <div style={{ width: "90px", textAlign: "right", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                    {formatCurrency(item.design_price)}
                                  </div>
                                  <div style={{ width: "90px", textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                    1 hr
                                  </div>
                                  <div style={{ minWidth: "90px", textAlign: "right", fontSize: "0.9rem", fontWeight: 600, color: item.has_design ? "var(--success)" : "var(--text-muted)" }}>
                                    {formatCurrency(item.has_design ? item.design_price : 0)}
                                  </div>
                                  <div style={{ width: "32px" }}></div>
                                </div>
                              )}

                              {/* Transport Row */}
                              {item.transport_price !== undefined && item.transport_price > 0 && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", opacity: item.has_transport ? 1 : 0.5, transition: "opacity 0.2s" }}>
                                  <div style={{ flex: 1, minWidth: "180px" }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>
                                      <input 
                                        type="checkbox" 
                                        checked={item.has_transport ?? true} 
                                        onChange={(e) => handleToggleServiceOption(idx, 'transport', e.target.checked)}
                                        style={{ width: 'auto', margin: 0 }}
                                      /> 
                                      Transporte / Movilidad
                                    </label>
                                  </div>
                                  <div style={{ width: "90px", textAlign: "right", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                    {formatCurrency(item.transport_price)}
                                  </div>
                                  <div style={{ width: "90px", textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                    1 viaje
                                  </div>
                                  <div style={{ minWidth: "90px", textAlign: "right", fontSize: "0.9rem", fontWeight: 600, color: item.has_transport ? "var(--success)" : "var(--text-muted)" }}>
                                    {formatCurrency(item.has_transport ? item.transport_price : 0)}
                                  </div>
                                  <div style={{ width: "32px" }}></div>
                                </div>
                              )}

                              {item.has_design === false && (
                                <div style={{ marginTop: 4, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-divider)' }}>
                                  <span style={{ fontSize: '0.75rem', display: 'block', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                    * Importante: Como desmarcaste Diseño Gráfico, deberás enviar tu archivo final por WhatsApp.
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Client Contact Info Form */}
                <div
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "1.5rem",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "1rem" }}>
                    Tus Datos de Contacto
                  </h2>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                        Nombre completo o Razón Social *
                      </label>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Ej: Impresos del Norte S.A.C. / Juan Pérez"
                        className="form-input"
                        style={{ width: "100%", padding: "0.55rem 0.8rem" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                        Teléfono / WhatsApp * (para coordinar)
                      </label>
                      <input
                        type="tel"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="Ej: 987654321"
                        className="form-input"
                        style={{ width: "100%", padding: "0.55rem 0.8rem" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                        RUC o DNI (Opcional)
                      </label>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <input
                          type="text"
                          value={clientRuc}
                          onChange={(e) => setClientRuc(e.target.value)}
                          placeholder="11 dígitos (RUC)"
                          className="form-input"
                          style={{ width: "100%", padding: "0.55rem 0.8rem" }}
                        />
                        {clientRuc.length === 11 && (
                          <button
                            type="button"
                            onClick={handleSearchRuc}
                            disabled={searchingRuc}
                            className="btn btn-secondary"
                            style={{ padding: "0.45rem 0.75rem", fontSize: "0.75rem", whiteSpace: "nowrap" }}
                          >
                            {searchingRuc ? "..." : "Sunat"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ gridColumn: "span 2" }}>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                        Dirección o Lugar de entrega (Opcional)
                      </label>
                      <input
                        type="text"
                        value={clientAddress}
                        onChange={(e) => setClientAddress(e.target.value)}
                        placeholder="Ej: Av. Benavides 1234, Miraflores"
                        className="form-input"
                        style={{ width: "100%", padding: "0.55rem 0.8rem" }}
                      />
                    </div>

                    <div style={{ gridColumn: "span 2" }}>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                        Comentarios o especificaciones adicionales
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Indica acabados, detalles de instalación, urgencia o medidas especiales..."
                        className="form-input"
                        style={{ width: "100%", padding: "0.55rem 0.8rem" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Totals & Generation CTA */}
              <div style={{ position: "sticky", top: "5rem" }}>
                <div
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "1.75rem",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "1.25rem" }}>
                    Resumen Estimado
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                      <span>Subtotal estimado:</span>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatCurrency(subtotal)}</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                      <span>I.G.V. (18%):</span>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatCurrency(igv)}</span>
                    </div>

                    <div
                      style={{
                        borderTop: "1px solid var(--surface-divider)",
                        paddingTop: "0.85rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>Total preliminar:</span>
                      <span style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--accent)" }}>
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>

                  {/* Clarification Alert */}
                  <div
                    style={{
                      background: "rgba(245, 158, 11, 0.08)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      borderRadius: "var(--radius-md)",
                      padding: "0.75rem",
                      fontSize: "0.8rem",
                      color: "#92400e",
                      lineHeight: 1.4,
                      marginBottom: "1.5rem",
                      display: "flex",
                      gap: "0.5rem",
                    }}
                  >
                    <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <span>
                      <strong>Importante:</strong> Los precios son referenciales y quedan sujetos a confirmación técnica tras
                      validar requerimientos con nuestro asesor.
                    </span>
                  </div>

                  {/* Submission CTA */}
                  <button
                    onClick={handleGenerateQuote}
                    disabled={submitting || items.length === 0}
                    className="btn btn-primary"
                    style={{
                      width: "100%",
                      padding: "0.95rem",
                      fontSize: "1rem",
                      fontWeight: 700,
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.6rem",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    {submitting ? (
                      <span>Generando cotización...</span>
                    ) : (
                      <>
                        <Send size={18} />
                        <span>Generar Cotización</span>
                      </>
                    )}
                  </button>

                  {!currentUser && (
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.75rem" }}>
                      Se solicitará iniciar sesión con Google para registrar formalmente tu solicitud.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Google Login Modal */}
      {showGoogleModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--surface-border)",
              maxWidth: "460px",
              width: "100%",
              padding: "2.25rem",
              textAlign: "center",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--accent-light)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem auto",
              }}
            >
              <LogIn size={26} />
            </div>

            <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              Registra tu Cotización
            </h3>

            <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.5, marginBottom: "1.75rem" }}>
              Para guardar tu cotización, asociarla a tu historial y coordinar tu orden por WhatsApp, continúa con tu cuenta de Google.
            </p>

            <button
              onClick={handleGoogleLogin}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                padding: "0.85rem 1.25rem",
                border: "1px solid var(--surface-border)",
                borderRadius: "var(--radius-md)",
                background: "#ffffff",
                color: "#1e293b",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
                marginBottom: "1rem",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>

            <button
              onClick={() => setShowGoogleModal(false)}
              className="btn btn-ghost"
              style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
