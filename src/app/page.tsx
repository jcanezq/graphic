"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { useToast } from "@/components/ToastProvider";
import { ProductCard } from "@/components/public/ProductCard";
import { QuoteItemThumb } from "@/components/public/QuoteItemThumb";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { HeroCarousel, type Banner } from "@/components/public/HeroCarousel";
import { formatCurrency, normalizeText } from "@/lib/formatters";
import type { PublicProduct } from "@/types";
import { round2 } from "@/lib/pricing";
import {
  Calculator,
  Search,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Layers,
  PhoneCall,
  Clock,
  Printer,
  ChevronRight,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  const [quoteItems, setQuoteItems] = useState<any[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cotigrafic_quote_items");
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        // Los borradores guardados antes de esta versión no traen row_key.
        setQuoteItems(
          parsed.map((it: any, i: number) => ({
            ...it,
            row_key: it.row_key ?? `legacy-${i}-${Math.random().toString(36).slice(2, 9)}`,
          }))
        );
      }
    } catch { /* ignore */ }
  }, []);

  function persistQuote(next: any[]) {
    setQuoteItems(next);
    try {
      localStorage.setItem("cotigrafic_quote_items", JSON.stringify(next));
      window.dispatchEvent(new Event("cotigrafic_cart_updated"));
    } catch {}
  }

  const { data, isLoading, isError: catalogError, refetch: refetchCatalog } = useQuery({
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

  const products = data?.products || [];
  const categories = data?.categories || [];
  const settings = data?.settings;

  // El slug viaja en la URL —lo usan los banners de la portada— y hay que
  // traducirlo al id, porque el filtro del catálogo trabaja con category_id.
  //
  // Se lee con window.location en un efecto y NO con useSearchParams: esta
  // página se prerenderiza (sale ○ en la tabla de rutas del build), y
  // useSearchParams en una página estática obliga a envolverla en <Suspense> o
  // el build falla. Para leer un parámetro una sola vez, esto es más barato y no
  // cambia la naturaleza de la página.
  const [categoriaInicial, setCategoriaInicial] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!categories.length) return;
    const slug = new URLSearchParams(window.location.search).get("categoria");
    if (!slug) return;
    const cat = categories.find((c: any) => c.slug === slug);
    // Un slug que no existe NO filtra: se muestra el catálogo entero. Dejarlo en
    // cero resultados sería castigar al visitante por un enlace mal escrito.
    if (cat) setCategoriaInicial(cat.id);
  }, [categories]);

  const { data: bannersData } = useQuery({
    queryKey: ["home_banners"],
    queryFn: async () => {
      const res = await fetch("/api/public/banners");
      if (!res.ok) return { banners: [] };
      return res.json() as Promise<{ banners: Banner[] }>;
    },
  });
  const banners = bannersData?.banners ?? [];

  function addToQuote(product: PublicProduct) {
    try {
      const items = [...quoteItems];
      // Cada selección agrega una LÍNEA NUEVA, aunque el producto ya esté en la
      // lista. Dos unidades del mismo artículo pueden diferir en color o acabado,
      // y esa diferencia se escribe en la observación de cada línea (24-spec-OBS).
      // El administrador ya se comporta así (nueva/page.tsx:176).
      items.push({
        row_key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        product_id: product.id,
        product_name: product.name,
        product_code: product.code,
        product_type: product.type,
        unit: product.unit,
        base_unit_price: product.base_unit_price ?? product.unit_price,
        unit_price: product.unit_price,
        quantity: 1,
        has_labor: true,
        has_design: true,
        has_transport: true,
        labor_price: product.labor_price,
        design_price: product.design_price,
        transport_price: product.transport_price,
        labor_scope: product.labor_scope,
        design_scope: product.design_scope,
        transport_scope: product.transport_scope,
        material_price: product.material_price,
        other_price: product.other_price,
        image_url: product.image_url ?? null,
      });
      persistQuote(items);
      showToast(`"${product.name}" añadido a tu cotizador`);
    } catch (e) {
      console.error(e);
      showToast("Error al agregar producto", "error");
    }
  }

  function handleQuantityChange(index: number, val: number) {
    const qty = Math.max(1, val);
    const updated = [...quoteItems];
    updated[index].quantity = qty;
    persistQuote(updated);
  }

  function handleRemoveItem(index: number) {
    const updated = quoteItems.filter((_, i) => i !== index);
    persistQuote(updated);
    showToast("Ítem eliminado");
  }

  function lineTotal(it: any): number {
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

  const subtotal = round2(quoteItems.reduce((acc, it) => acc + lineTotal(it), 0));
  const igv = round2(subtotal * (settings?.igv_rate ?? 0.18));
  const total = round2(subtotal + igv);

  function addAndGoToQuote(product: PublicProduct) {
    addToQuote(product);
    router.push("/cotizar");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
      <PublicNavbar />

      {/* La portada es el carrusel, y nada más. El título y el párrafo que vivían
          acá se eliminaron por pedido del dueño: esa zona es del carrusel.
          Sin banners cargados NO se dibuja nada y el catálogo queda arriba del
          todo — es deliberado, no un respaldo que falta. */}
      {banners.length > 0 && <HeroCarousel banners={banners} />}



      {/* Catalog Section */}
      {/* 1.5rem arriba en vez de 4rem: el catálogo es lo que la gente viene a
          ver, y 64 px de aire antes de la grilla eran 64 px de nada. */}
      <section id="catalogo" style={{ padding: "1.5rem 1.5rem 4rem 1.5rem", flex: 1 }}>

        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <div className={`catalog-layout ${quoteItems.length > 0 ? "has-cart" : ""}`}>
            <div>
          {/* Header & Search */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              flexWrap: "wrap",
              gap: "1.5rem",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Catálogo de Productos y Servicios
              </h2>
              <div style={{ marginTop: "0.5rem", fontSize: "0.86rem", color: "var(--warning)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ShieldAlert size={16} />
                <span>
                  <strong>Precios referenciales:</strong> Todo presupuesto generado está sujeto a confirmación y
                  validación técnica de artes por nuestro equipo especializado.
                </span>
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "4rem 0" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  margin: "0 auto 1rem auto",
                  border: "3px solid rgba(0, 0, 0, 0.2)",
                  borderTop: "3px solid var(--accent)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Cargando catálogo...</p>
            </div>
          ) : catalogError ? (
            <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
              <ShieldAlert size={28} style={{ color: "var(--danger)", marginBottom: 8 }} />
              <h3>No pudimos cargar el catálogo</h3>
              <p className="subtitle" style={{ marginBottom: 12 }}>
                Puede ser una falla momentánea de conexión.
              </p>
              <button className="btn btn-secondary" onClick={() => refetchCatalog()}>
                Reintentar
              </button>
            </div>
          ) : (
            <CatalogBrowser
              products={products}
              categories={categories}
              onAdd={addToQuote}
              initialCategoryId={categoriaInicial}
            />
          )}
          </div>

          {/* Right Panel Cart */}
            {quoteItems.length > 0 && (
              <div
                className="cart-panel"
                style={{
                  position: "sticky",
                  top: "2rem",
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
                
                {/* 2. Generation CTA */}
                <button
                  onClick={() => router.push("/cotizar")}
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
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  }}
                >
                  Ver mi cotización
                </button>

                {/* 3. Separator */}
                <hr style={{ border: "none", borderTop: "1px solid var(--surface-divider)", margin: "1.25rem 0" }} />

                {/* 4. Thumbnails Grid */}
                <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "1rem" }}>
                  Ítems ({quoteItems.length})
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  {quoteItems.map((it, idx) => (
                    <QuoteItemThumb
                      key={it.row_key ?? `idx-${idx}`}
                      imageUrl={it.image_url}
                      productName={it.product_name}
                      lineTotal={lineTotal(it)}
                      quantity={it.quantity}
                      onIncrease={() => handleQuantityChange(idx, it.quantity + 1)}
                      onDecrease={() => {
                        if (it.quantity > 1) handleQuantityChange(idx, it.quantity - 1);
                        else handleRemoveItem(idx);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bottom Bar for Mobile */}
      {quoteItems.length > 0 && (
        <div
          className="cart-bottom-bar"
          style={{
            display: "none", // Hidden by default, shown via media query
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "var(--bg-secondary)",
            borderTop: "1px solid var(--surface-border)",
            padding: "1rem 1.5rem",
            boxShadow: "0 -4px 12px rgba(0,0,0,0.1)",
            zIndex: 50,
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Total preliminar</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--price)" }}>{formatCurrency(total)}</div>
          </div>
          <button
            onClick={() => router.push("/cotizar")}
            style={{
              padding: "0.75rem 1.25rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: "var(--radius-md)",
              background: "#191919",
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Ver cotización ({quoteItems.length})
          </button>
        </div>
      )}

      {/* 3 Simple Steps */}
      <section style={{ padding: "2.5rem 1.5rem", background: "var(--bg-secondary)", borderBottom: "1px solid var(--surface-border)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>
              ¿Cómo funciona tu cotización?
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {[
              {
                step: "01",
                icon: <Printer size={24} color="var(--accent)" />,
                title: "Elige tus productos",
                desc: "Explora el catálogo, selecciona los materiales y la cantidad o medidas que necesitas.",
              },
              {
                step: "02",
                icon: <Clock size={24} color="var(--accent)" />,
                title: "Cálculo instantáneo",
                desc: "Visualiza de inmediato el estimado de inversión sin intermediarios ni demoras.",
              },
              {
                step: "03",
                icon: <PhoneCall size={24} color="var(--accent)" />,
                title: "Confirma por WhatsApp",
                desc: "Conéctate con tu asesor para validar tus artes finales y coordinar el despacho o instalación.",
              },
            ].map((st) => (
              <div
                key={st.step}
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--surface-border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.5rem",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "1rem",
                    right: "1.25rem",
                    fontSize: "1.75rem",
                    fontWeight: 800,
                    color: "rgba(0, 0, 0, 0.12)",
                  }}
                >
                  {st.step}
                </div>
                <div style={{ marginBottom: "1rem" }}>{st.icon}</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.4rem", color: "var(--text-primary)" }}>
                  {st.title}
                </h3>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {st.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--surface-border)",
          padding: "2.5rem 1.5rem",
          marginTop: "auto",
        }}
      >
        <div
          style={{
            maxWidth: "1240px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1.5rem",
          }}
        >
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
              Coti<span style={{ color: "var(--accent)" }}>Grafix</span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              Plataforma de cotización para servicios gráficos y publicitarios.
            </p>
          </div>

          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            © {new Date().getFullYear()} CotiGrafix. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
// Trigger PR
