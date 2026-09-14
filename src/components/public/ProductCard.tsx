import React from "react";
import type { PublicProduct } from "@/types";
import { formatCurrency } from "@/lib/formatters";
import { Plus } from "lucide-react";

interface ProductCardProps {
  product: PublicProduct;
  onAdd: (product: PublicProduct) => void;
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--surface-border)",
        borderRadius: "4px", // Radio de esquina 4px (DIS-T2)
        padding: "8px", // Padding interno 8px (DIS-T2)
        display: "flex",
        flexDirection: "column",
        position: "relative",
        transition: "box-shadow 0.2s ease",
      }}
      className="product-card"
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
        e.currentTarget.style.zIndex = "10";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.zIndex = "1";
      }}
    >
      {/* 1:1 Image Container */}
      <div
        style={{
          width: "100%",
          paddingBottom: "100%",
          position: "relative",
          marginBottom: "8px",
          background: "#f5f5f5",
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        {product.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element --
             Deliberado: la imagen se sirve directo de Supabase Storage y NO por /_next/image.
             Motivo en 12-spec-DIS §DIS-T3 (costo del plan Pro, cláusula comercial de Vercel Hobby
             y CVE del optimizador de Next 14). No cambiar a next/image sin revisar esa decisión. */
          <img
            src={product.image_url}
            alt={product.name}
            style={{
              position: "absolute",
              top: "50%",
              left: "0",
              transform: "translateY(-50%)",
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            loading="lazy"
          />
        ) : (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "14px",
              background: "#ebebeb",
            }}
          >
            {product.name}
          </div>
        )}

        {/* Quick Add Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd(product);
          }}
          title="Agregar a mi cotización"
          style={{
            position: "absolute",
            bottom: "12px",
            right: "12px",
            width: "48px",
            height: "48px",
            borderRadius: "24px",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--surface-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.3s",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#000000";
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-secondary)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px", height: "26px" }}>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--price)",
            }}
          >
            {formatCurrency(product.unit_price)}
          </span>
        </div>

        <h3
          style={{
            fontSize: "14px",
            fontWeight: 400,
            color: "var(--text-primary)",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.3,
            minHeight: "36px", // approx 2 lines
          }}
          title={product.name}
        >
          {product.name}
        </h3>
        
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
          por {product.unit}
        </div>
      </div>
    </div>
  );
}
