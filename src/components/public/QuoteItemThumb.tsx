import React from "react";
import { formatCurrency } from "@/lib/formatters";
import { ProductThumbnail } from "./ProductThumbnail";

interface QuoteItemThumbProps {
  imageUrl?: string | null;
  productName: string;
  lineTotal: number;
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

export function QuoteItemThumb({
  imageUrl,
  productName,
  lineTotal,
  quantity,
  onIncrease,
  onDecrease,
}: QuoteItemThumbProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {/* Image 1:1 */}
      <ProductThumbnail imageUrl={imageUrl} productName={productName} size="100%" />
      
      {/* Description */}
      <div
        title={productName}
        style={{
          fontSize: "12px",
          fontWeight: 400,
          color: "var(--text-primary)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          lineHeight: 1.3,
        }}
      >
        {productName}
      </div>
      
      {/* Price */}
      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--price)" }}>
        {formatCurrency(lineTotal)}
      </div>
      
      {/* Stepper */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: "1px solid var(--surface-border)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          height: "28px",
        }}
      >
        <button
          onClick={onDecrease}
          style={{
            flex: 1,
            height: "100%",
            background: "var(--bg-primary)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
          }}
        >
          -
        </button>
        <div
          style={{
            flex: 1.2,
            textAlign: "center",
            fontSize: "0.85rem",
            fontWeight: 600,
            borderLeft: "1px solid var(--surface-border)",
            borderRight: "1px solid var(--surface-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {quantity}
        </div>
        <button
          onClick={onIncrease}
          style={{
            flex: 1,
            height: "100%",
            background: "var(--bg-primary)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
