"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, normalizeText } from "@/lib/formatters";
import { fetchDocumentData } from "@/lib/ruc";
import type { PublicProduct } from "@/types";
import { ProductThumbnail } from "@/components/public/ProductThumbnail";
import { round2 } from "@/lib/pricing";
import {
  Calculator,
  Trash2,
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
  /** Identidad de ESTA línea, no del producto. Dos líneas pueden compartir
   *  product_id y diferenciarse sólo en su observación. */
  row_key?: string;
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
  labor_scope?: string;
  design_scope?: string;
  transport_scope?: string;
  image_url?: string | null;
  /** Observación libre de esta línea, escrita por el cliente. */
  notes?: string | null;
  /** Ruta del arte en el bucket privado `client-art`. NO es una URL. */
  client_design_url?: string | null;
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
  const [isRegisteredClient, setIsRegisteredClient] = useState(false);

  // Auto-fill RUC from DB if available
  useEffect(() => {
    async function checkRucInDB() {
      if ((clientRuc.length === 8 || clientRuc.length === 11) && currentUser) {
        const { data } = await supabase.from('clients').select('*').eq('ruc', clientRuc).limit(1).maybeSingle();
        if (data) {
          setIsRegisteredClient(true);
          setClientName(data.name || "");
          setClientAddress(data.address || "");
          if (data.phone) setClientPhone(data.phone);
          if (data.email) setClientEmail(data.email);
          showToast("Datos completados desde tus clientes registrados");
        } else {
          setIsRegisteredClient(false);
        }
      } else {
        setIsRegisteredClient(false);
      }
    }
    checkRucInDB();
  }, [clientRuc, currentUser, supabase, showToast]);

  // Product selector dropdown (removed)

  // Submission & Auth Modal state
  const [submitting, setSubmitting] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [completedQuote, setCompletedQuote] = useState<{
    quotationId: string;
    number: string;
    total: number;
    whatsappUrl: string;
  } | null>(null);

  // Load catalog for settings
  const { data: catalogData } = useQuery({
    queryKey: ["public_products"],
    queryFn: async () => {
      const res = await fetch("/api/public/products");
      if (!res.ok) throw new Error("Error cargando productos");
      return res.json() as Promise<{
        products: PublicProduct[];
        categories: Array<{ id: string; name: string; slug: string; color: string | null }>;
        settings: { company_name: string; phone: string; igv_rate: number };
      }>;
    },
  });

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
            const migrated = parsed.map((item: any, i: number) => ({
              row_key: item.row_key ?? `legacy-${i}-${Math.random().toString(36).slice(2, 9)}`,
              ...item,
              base_unit_price: item.base_unit_price ?? item.unit_price ?? 0,
              product_type: item.product_type || (item.product_code?.startsWith('SRV') ? 'Servicio' : 'Producto')
            }));
            setItems(migrated);
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

  const [subiendoArte, setSubiendoArte] = useState<number | null>(null);

  async function handleArtUpload(index: number, file: File) {
    // La sesión no es opcional: las políticas de 'client-art' exigen que la
    // carpeta sea el uid de quien sube. Sin sesión, Storage responde 403.
    if (!currentUser) {
      setShowGoogleModal(true);
      return;
    }
    setSubiendoArte(index);
    try {
      const ext = file.name.split(".").pop();
      const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      // El primer segmento DEBE ser el uid: lo exige la política del bucket
      // y lo vuelve a comprobar el servidor al guardar.
      const ruta = `${currentUser.id}/${nombre}`;

      const { error } = await supabase.storage.from("client-art").upload(ruta, file);
      if (error) throw error;

      const updated = [...items];
      updated[index] = { ...updated[index], client_design_url: ruta };
      persistItems(updated);
      showToast("Arte adjuntado");
    } catch (err: any) {
      showToast(err?.message || "No se pudo subir el archivo", "error");
    } finally {
      setSubiendoArte(null);
    }
  }

  function handleNotesChange(index: number, val: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], notes: val };
    persistItems(updated);
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
    
    // El precio ya NO se muta acá: lineTotal() lo deriva de los flags.
    // Mutarlo era lo que permitía que un carrito viejo congelara como base
    // un precio ya descontado y no se pudiera recuperar.
    
    persistItems(updated);
  }



  // Verificación automática: en cuanto el documento queda completo se consulta
  // solo, una única vez por número. El botón sigue estando para reintentar.
  // El límite de la ruta es de 20 consultas por minuto y por usuario
  // (api/ruc/route.ts:10), así que una por documento no se le acerca.
  const ultimoDocConsultado = useRef<string>("");

  useEffect(() => {
    const doc = clientRuc.replace(/\D/g, "");
    if (![8, 11].includes(doc.length)) return;
    if (isRegisteredClient) return;
    if (ultimoDocConsultado.current === doc) return;

    const t = setTimeout(() => {
      ultimoDocConsultado.current = doc;
      handleSearchDocumento(true);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientRuc, isRegisteredClient]);

  async function handleSearchDocumento(silencioso = false) {
    const doc = clientRuc.replace(/\D/g, "");
    if (doc.length !== 8 && doc.length !== 11) return;
    try {
      setSearchingRuc(true);
      const data = await fetchDocumentData(doc);
      setClientName(data.nombre);
      if (data.direccion) {
        setClientAddress(data.direccion);
      }
      showToast(data.tipo === 'DNI' ? "Datos de Reniec obtenidos" : "Datos de Sunat obtenidos");
    } catch (err: any) {
      // En la consulta automática el usuario no pidió nada: si el servicio no
      // responde, que escriba el nombre a mano sin un error en la cara. Con el
      // botón sí se avisa, porque ahí sí lo pidió.
      if (!silencioso) showToast(err.message, "error");
    } finally {
      setSearchingRuc(false);
    }
  }

  // Calculate totals
  // Mismo modelo de filas que el servidor (src/lib/pricing.ts): el carrito
  // ya no multiplica los componentes por la cantidad si su scope es 'order'.
  function lineTotal(it: DraftItem): number {
    const qty = Math.max(1, Number(it.quantity) || 1);
    const base = round2(qty * (Number(it.base_unit_price) || 0));
    const comp = (price: number | undefined, enabled: boolean | undefined, scope: string | undefined) => {
      if (enabled === false) return 0;
      const p = Number(price) || 0;
      if (!(p > 0)) return 0;
      return round2((scope === 'unit' ? qty : 1) * p);
    };
    return round2(
      base
      + comp(it.labor_price, it.has_labor, it.labor_scope)
      + comp(it.design_price, it.has_design, it.design_scope)
      + comp(it.transport_price, it.has_transport, it.transport_scope)
    );
  }

  const subtotal = round2(items.reduce((acc, it) => acc + lineTotal(it), 0));
  const igv = round2(subtotal * igvRate);
  const total = round2(subtotal + igv);

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

    // La sesión se pide ANTES que los datos del formulario. Si no, quien no inició
    // sesión recibe «ingresa tu nombre» —un pedido de campo— cuando lo que de verdad
    // le falta es registrarse, y el modal que se lo explicaría queda detrás de dos
    // campos que todavía no llenó. Además, el nombre que escribiera se descarta al
    // volver del ingreso: gana el de la cuenta de Google (ver :158 y :136).
    if (!currentUser) {
      setShowGoogleModal(true);
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
            client_design_url: it.client_design_url ?? null,
            notes: it.notes ?? null,
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "2rem", alignItems: "start" }}>
              {/* Left Column: Items and Selection */}
              <div>


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
                          key={item.row_key ?? `${item.product_id}-${idx}`}
                          style={{
                            padding: "1rem 1.25rem",
                            borderBottom: idx < items.length - 1 ? "1px solid var(--surface-divider)" : "none",
                            display: "flex",
                            flexDirection: "column",
                            gap: "1rem",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
                            <div style={{ flexShrink: 0 }}>
                              <style>{`
                                .thumb-wrapper-${idx} { width: 56px; height: 56px; }
                                @media (min-width: 700px) { .thumb-wrapper-${idx} { width: 80px; height: 80px; } }
                              `}</style>
                              <div className={`thumb-wrapper-${idx}`}>
                                <ProductThumbnail imageUrl={item.image_url} productName={item.product_name} size="100%" />
                              </div>
                            </div>
                            
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", minWidth: "250px" }}>
                              <div style={{ flex: 1, minWidth: "150px" }}>
                                <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                                  {item.product_name}
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                  Cód: {item.product_code}
                                </div>
                              </div>
                              
                              {/* P.V. Unit */}
                              <div style={{ width: "90px", textAlign: "right" }}>
                                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>P.V. Unit</span>
                                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                                  {formatCurrency(item.base_unit_price)}
                                </span>
                              </div>

                              {/* Quantity control */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "90px" }}>
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
                                <div style={{ minWidth: "90px", textAlign: "right", fontSize: "0.95rem", fontWeight: 700, color: "var(--price)" }}>
                                  {formatCurrency(lineTotal(item))}
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
                          </div>


                          {/* Components Rows */}
                          {((item.labor_price ?? 0) > 0 || (item.design_price ?? 0) > 0 || (item.transport_price ?? 0) > 0) && (
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
                                    {item.labor_scope === 'unit' ? Math.max(1, item.quantity) : 1} hr
                                  </div>
                                  <div style={{ minWidth: "90px", textAlign: "right", fontSize: "0.9rem", fontWeight: 600, color: item.has_labor ? "var(--success)" : "var(--text-muted)" }}>
                                    {formatCurrency(item.has_labor ? round2((item.labor_scope === 'unit' ? Math.max(1, item.quantity) : 1) * (item.labor_price ?? 0)) : 0)}
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
                                    {item.design_scope === 'unit' ? Math.max(1, item.quantity) : 1} hr
                                  </div>
                                  <div style={{ minWidth: "90px", textAlign: "right", fontSize: "0.9rem", fontWeight: 600, color: item.has_design ? "var(--success)" : "var(--text-muted)" }}>
                                    {formatCurrency(item.has_design ? round2((item.design_scope === 'unit' ? Math.max(1, item.quantity) : 1) * (item.design_price ?? 0)) : 0)}
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
                                    {item.transport_scope === 'unit' ? Math.max(1, item.quantity) : 1} viaje
                                  </div>
                                  <div style={{ minWidth: "90px", textAlign: "right", fontSize: "0.9rem", fontWeight: 600, color: item.has_transport ? "var(--success)" : "var(--text-muted)" }}>
                                    {formatCurrency(item.has_transport ? round2((item.transport_scope === 'unit' ? Math.max(1, item.quantity) : 1) * (item.transport_price ?? 0)) : 0)}
                                  </div>
                                  <div style={{ width: "32px" }}></div>
                                </div>
                              )}

                            </div>
                          )}

                          {/* Arte del cliente. Fuera del panel de componentes: el orden
                              del ítem es componentes → arte → observación, igual que en
                              las dos pantallas del administrador. */}
                          {item.has_design === false && (
                            <div style={{ margin: "0 1.25rem 0.5rem", marginLeft: "1rem", padding: 8, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-divider)' }}>
                              <span style={{ fontSize: '0.75rem', display: 'block', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                Como desmarcaste Diseño Gráfico, adjuntá acá tu archivo final.
                              </span>

                              {!currentUser ? (
                                <button
                                  type="button"
                                  onClick={() => setShowGoogleModal(true)}
                                  style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                  Inicia sesión para adjuntar tu arte
                                </button>
                              ) : item.client_design_url ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
                                  <span style={{ color: 'var(--success)' }}>✓ Archivo adjuntado</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...items];
                                      updated[idx] = { ...updated[idx], client_design_url: null };
                                      persistItems(updated);
                                    }}
                                    style={{ fontSize: '0.75rem', color: 'var(--error)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                  >
                                    Quitar
                                  </button>
                                </div>
                              ) : (
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/tiff,application/pdf"
                                  disabled={subiendoArte === idx}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleArtUpload(idx, f);
                                  }}
                                  style={{ fontSize: '0.72rem', width: '100%' }}
                                />
                              )}
                            </div>
                          )}

                          {/* Observación de la línea. Va última: cierra el ítem. */}
                          <div style={{ padding: "0 1.25rem 0.75rem", marginLeft: "1rem" }}>
                            <textarea
                              value={item.notes ?? ""}
                              onChange={(e) => handleNotesChange(idx, e.target.value)}
                              placeholder="Observaciones de este ítem (opcional)"
                              rows={2}
                              style={{
                                width: "100%",
                                fontSize: "0.8rem",
                                padding: "0.5rem 0.65rem",
                                border: "1px solid var(--surface-border)",
                                borderRadius: "var(--radius-sm)",
                                background: "var(--bg-primary)",
                                color: "var(--text-primary)",
                                resize: "vertical",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Client Contact Info Form */}
                {currentUser && (
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
                        RUC o DNI (Opcional)
                      </label>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <input
                          type="text"
                          value={clientRuc}
                          onChange={(e) => setClientRuc(e.target.value)}
                          placeholder="8 dígitos (DNI) u 11 (RUC)"
                          className="form-input"
                          style={{ width: "100%", padding: "0.55rem 0.8rem" }}
                        />
                        {!isRegisteredClient && (
                          <button
                            type="button"
                            onClick={() => handleSearchDocumento()}
                            disabled={
                              searchingRuc ||
                              ![8, 11].includes(clientRuc.replace(/\D/g, "").length)
                            }
                            className="btn btn-secondary"
                            style={{ padding: "0.45rem 0.75rem", fontSize: "0.75rem", whiteSpace: "nowrap" }}
                            title="Consultar en SUNAT (RUC) o RENIEC (DNI)"
                          >
                            {searchingRuc ? "..." : "Consultar"}
                          </button>
                        )}
                      </div>
                    </div>

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
                        disabled={isRegisteredClient}
                      />
                    </div>

                    <div style={{ gridColumn: "span 2" }}>
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
                )}
              </div>

              {/* Right Column: Totals & Generation CTA */}
              <div className="quote-summary">
                <div
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "1.25rem",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  {/* 1. Total at the top */}
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                      Total preliminar
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--price)" }}>
                      {formatCurrency(total)}
                    </div>
                  </div>

                  {/* Clarification Alert */}
                  <div
                    style={{
                      background: "var(--warning-light, rgba(245, 158, 11, 0.08))",
                      border: "1px solid var(--warning, rgba(245, 158, 11, 0.3))",
                      borderRadius: "var(--radius-md)",
                      padding: "0.75rem",
                      fontSize: "0.8rem",
                      color: "var(--warning, var(--warning))",
                      lineHeight: 1.4,
                      marginBottom: "1rem",
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

                  {/* 2. Generation CTA */}
                  <button
                    onClick={handleGenerateQuote}
                    disabled={submitting || items.length === 0}
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
                      background: "#191919",
                      color: "#ffffff",
                      border: "none",
                      cursor: submitting || items.length === 0 ? "not-allowed" : "pointer",
                      opacity: submitting || items.length === 0 ? 0.6 : 1,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                  >
                    {submitting ? (
                      <span>Generando...</span>
                    ) : (
                      <>
                        <Send size={18} />
                        <span>Generar Cotización</span>
                      </>
                    )}
                  </button>

                  {!currentUser && (
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.75rem" }}>
                      Se solicitará iniciar sesión con Google.
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
                color: "var(--text-primary)",
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
