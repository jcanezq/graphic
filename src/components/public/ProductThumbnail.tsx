import React from "react";

interface ProductThumbnailProps {
  imageUrl?: string | null;
  productName: string;
  /** Lado del cuadrado. La grilla usa 100%, la fila del cotizador 80px. */
  size?: number | string;
}

export function ProductThumbnail({ imageUrl, productName, size = "100%" }: ProductThumbnailProps) {
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        ...(size === "100%" && { paddingBottom: "100%", height: 0 }),
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        background: "var(--bg-primary)",
        flexShrink: 0,
      }}
    >
      {imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element --
           Deliberado: la imagen se sirve directo de Supabase Storage y NO por /_next/image.
           Motivo en 12-spec-DIS §DIS-T3 (costo del plan Pro, cláusula comercial de Vercel Hobby
           y CVE del optimizador de Next 14). No cambiar a next/image sin revisar esa decisión. */
        <img
          src={imageUrl}
          alt={productName}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.5rem",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.75rem",
            fontWeight: 500,
            wordBreak: "break-word",
          }}
        >
          {productName}
        </div>
      )}
    </div>
  );
}
