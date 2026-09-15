import React, { useState } from "react";
import { Search, ShieldAlert } from "lucide-react";
import { ProductCard } from "@/components/public/ProductCard";
import { normalizeText } from "@/lib/formatters";
import type { PublicProduct as CatalogProduct } from "@/types";

interface CatalogBrowserProps {
  products: CatalogProduct[];
  categories: { id: string; name: string }[];
  onAdd: (product: CatalogProduct) => void;
  /** El admin muestra el costo; el cliente sólo el precio de venta. */
  showCost?: boolean;
}

export function CatalogBrowser({ products, categories, onAdd, showCost }: CatalogBrowserProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"Todos" | "Producto" | "Servicio" | "Material">("Todos");

  const normalizedSearch = normalizeText(search);
  const searchTokens = normalizedSearch.split(/\s+/).filter(Boolean);

  // Un único criterio para las dos pantallas y los tres tipos: se oculta lo que no
  // se puede vender, y eso es `unit_price = 0`.
  //
  // NO uses `manual_unit_cost`: es la columna del costo cargado a mano, que sólo
  // tienen los materiales; en un Producto o un Servicio es NULL porque su costo se
  // calcula.
  //
  // NO uses `base_unit_price`: vale 0 para un servicio cuyo costo es todo mano de
  // obra, porque baseCost sólo suma materiales e indirectos (calculations.ts) y la
  // mano de obra se agrega recién en unitPrice.
  //
  // `unit_price` es el total —base + mano de obra + diseño + transporte— y con la
  // fórmula de este proyecto (precio = costo × (1 + margen/100)) sólo vale 0 cuando
  // el costo vale 0. Es exactamente «no tiene costo cargado».
  const validProducts = products.filter((p) => (p.unit_price ?? 0) > 0);
  
  const hiddenCount = products.length - validProducts.length;

  const filteredProducts = validProducts.filter((p) => {
    const matchCat = selectedCategory === "all" || p.category_id === selectedCategory;
    const matchType = typeFilter === "Todos" || p.type === typeFilter;
    if (!matchCat || !matchType) return false;
    if (searchTokens.length === 0) return true;

    const targetText = normalizeText(`${p.name} ${p.code} ${p.description || ""} ${p.category_name || ""}`);
    return searchTokens.every((token) => targetText.includes(token));
  });

  return (
    <div>
      {/* Search Input */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "var(--bg-secondary)",
            border: "1px solid var(--surface-border)",
            borderRadius: "var(--radius-md)",
            padding: "0.55rem 1rem",
            width: "100%",
            maxWidth: "340px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <Search size={17} color="var(--text-muted)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código..."
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: "0.9rem",
              width: "100%",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      {/* Type Filter Pills */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        {(["Todos", "Producto", "Servicio", "Material"] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              setTypeFilter(type);
              if (type === "Servicio" || type === "Material") {
                setSelectedCategory("all");
              }
            }}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "var(--radius-full)",
              fontSize: "0.85rem",
              fontWeight: typeFilter === type ? 600 : 500,
              border: typeFilter === type ? "1px solid var(--accent)" : "1px solid var(--surface-border)",
              background: typeFilter === type ? "var(--accent)" : "var(--bg-secondary)",
              color: typeFilter === type ? "#fff" : "var(--text-secondary)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "var(--transition-fast)",
            }}
          >
            {type === "Todos" ? "Todos los Tipos" : type === "Material" ? "Materiales" : type + "s"}
          </button>
        ))}
      </div>

      {/* Category Filter Pills */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <button
          onClick={() => setSelectedCategory("all")}
          style={{
            padding: "0.45rem 1rem",
            borderRadius: "var(--radius-full)",
            fontSize: "0.85rem",
            fontWeight: selectedCategory === "all" ? 600 : 500,
            border: selectedCategory === "all" ? "1px solid var(--accent)" : "1px solid var(--surface-border)",
            background: selectedCategory === "all" ? "var(--accent)" : "var(--bg-secondary)",
            color: selectedCategory === "all" ? "#fff" : "var(--text-secondary)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "var(--transition-fast)",
          }}
        >
          Todos los productos ({products.length})
        </button>

        {categories.map((cat) => {
          const count = products.filter((p) => p.category_id === cat.id).length;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "var(--radius-full)",
                fontSize: "0.85rem",
                fontWeight: isSelected ? 600 : 500,
                border: isSelected ? "1px solid var(--accent)" : "1px solid var(--surface-border)",
                background: isSelected ? "var(--accent)" : "var(--bg-secondary)",
                color: isSelected ? "#fff" : "var(--text-secondary)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "var(--transition-fast)",
              }}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {showCost && hiddenCount > 0 && (
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem", textAlign: "center" }}>
          {hiddenCount} productos ocultos por no tener costo cargado
        </div>
      )}

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3.5rem 1.5rem",
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius-lg)",
            border: "1px dashed var(--surface-border)",
          }}
        >
          <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            No se encontraron productos disponibles
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
            Prueba con otro término de búsqueda o categoría
          </p>
        </div>
      ) : (
        <div className="catalog-grid">
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={onAdd} showCost={showCost} />
          ))}
        </div>
      )}
    </div>
  );
}
