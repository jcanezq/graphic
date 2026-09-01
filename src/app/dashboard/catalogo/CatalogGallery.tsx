"use client";

import { useState } from "react";
import { Images, X } from "lucide-react";
import type { Category } from "@/types";

interface GalleryImage {
  name: string;
  url: string;
  category: string;
}

interface Props {
  categories: Category[];
  images: GalleryImage[];
}

export default function CatalogGallery({ categories, images }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const filteredImages =
    activeCategory === "all"
      ? images
      : images.filter((img) => img.category === activeCategory);

  return (
    <>
      {/* Category Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: "var(--space-lg)", flexWrap: "wrap" }}>
        <button
          className={`btn btn-sm ${activeCategory === "all" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveCategory("all")}
        >
          Todos
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`btn btn-sm ${activeCategory === cat.slug ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveCategory(cat.slug)}
            style={
              activeCategory === cat.slug
                ? {}
                : { borderColor: cat.color + "40", color: cat.color }
            }
          >
            {cat.name}
          </button>
        ))}
      </div>

      {images.length === 0 ? (
        <div className="card empty-state">
          <Images size={48} />
          <h3>Sin imágenes en el catálogo</h3>
          <p>
            Sube imágenes al bucket &quot;product-images/gallery&quot; en Supabase Storage para verlas aquí.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-md)",
          }}
        >
          {filteredImages.map((img, i) => (
            <div
              key={i}
              className="card"
              style={{
                padding: 0,
                overflow: "hidden",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onClick={() => setLightboxImage(img.url)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "var(--shadow-lg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: 200,
                  backgroundImage: `url(${img.url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div style={{ padding: "12px 16px" }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    textTransform: "capitalize",
                  }}
                >
                  {img.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="modal-backdrop"
          onClick={() => setLightboxImage(null)}
          style={{ padding: "2rem", zIndex: 1000 }}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <button
              className="btn-icon"
              onClick={() => setLightboxImage(null)}
              style={{
                position: "absolute",
                top: -16,
                right: -16,
                zIndex: 10,
                background: "var(--bg-elevated)",
              }}
            >
              <X size={18} />
            </button>
            <img
              src={lightboxImage}
              alt="Imagen ampliada"
              style={{
                maxWidth: "90vw",
                maxHeight: "85vh",
                borderRadius: "var(--radius-lg)",
                objectFit: "contain",
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
