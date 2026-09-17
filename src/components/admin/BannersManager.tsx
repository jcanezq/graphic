"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { Image as ImageIcon, Upload, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Save } from "lucide-react";

export function BannersManager() {
  const [supabase] = useState(() => createClient());
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [uploading, setUploading] = useState(false);
  const [newAltText, setNewAltText] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [newCtaLabel, setNewCtaLabel] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["admin_home_banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_banners")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  async function handleAddBanner(e: React.FormEvent) {
    e.preventDefault();
    if (!newFile) {
      showToast("Selecciona una imagen", "error");
      return;
    }
    if (!newAltText.trim()) {
      showToast("El texto alternativo es obligatorio", "error");
      return;
    }

    setUploading(true);
    try {
      const fileExt = newFile.name.split('.').pop();
      const filePath = `banners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(filePath, newFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("home_banners").insert({
        image_url: filePath,
        alt_text: newAltText.trim(),
        link_url: newLinkUrl.trim() || null,
        title: newTitle.trim() || null,
        subtitle: newSubtitle.trim() || null,
        cta_label: newCtaLabel.trim() || null,
        sort_order: banners.length,
      });

      if (dbError) throw dbError;

      showToast("Banner cargado correctamente");
      setNewFile(null);
      setNewAltText("");
      setNewLinkUrl("");
      setNewTitle("");
      setNewSubtitle("");
      setNewCtaLabel("");
      queryClient.invalidateQueries({ queryKey: ["admin_home_banners"] });
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const { error } = await supabase.from("home_banners").update({ is_active: !current }).eq("id", id);
    if (error) {
      showToast(error.message, "error");
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin_home_banners"] });
    }
  }

  async function deleteBanner(id: string, imageUrl: string) {
    if (!window.confirm("¿Seguro que quieres eliminar este banner?")) return;
    try {
      const { error: dbError } = await supabase.from("home_banners").delete().eq("id", id);
      if (dbError) throw dbError;

      const { error: storageError } = await supabase.storage.from("company-assets").remove([imageUrl]);
      if (storageError) console.error("Error al borrar del bucket", storageError);

      showToast("Banner eliminado");
      queryClient.invalidateQueries({ queryKey: ["admin_home_banners"] });
    } catch (error: any) {
      showToast(error.message, "error");
    }
  }

  async function moveBanner(id: string, index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === banners.length - 1) return;

    const newBanners = [...banners];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    const temp = newBanners[index];
    newBanners[index] = newBanners[targetIndex];
    newBanners[targetIndex] = temp;

    // Update sort_order for all to ensure consistency
    const updates = newBanners.map((b, i) => ({
      id: b.id,
      image_url: b.image_url,
      alt_text: b.alt_text,
      sort_order: i,
    }));

    const { error } = await supabase.from("home_banners").upsert(updates);
    if (error) {
      showToast(error.message, "error");
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin_home_banners"] });
    }
  }

  return (
    <div className="card" style={{ marginTop: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
        <ImageIcon size={20} style={{ color: "var(--accent)" }} />
        <h3 className="card-title">Banners de la Portada</h3>
      </div>
      <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
        Agrega banners promocionales para el carrusel de la página principal. Relación 4:1 (ej: 1600x400), menos de 300 KB, JPEG o WebP.
      </p>

      {/* Upload Form */}
      <form onSubmit={handleAddBanner} style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem" }}>
        <h4 style={{ marginBottom: "1rem", fontSize: "0.95rem" }}>Cargar nuevo banner</h4>
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Imagen</label>
            <input 
              type="file" 
              accept="image/jpeg,image/webp,image/png"
              onChange={(e) => setNewFile(e.target.files?.[0] || null)}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Texto alternativo (obligatorio)</label>
            <input 
              type="text" 
              value={newAltText}
              onChange={(e) => setNewAltText(e.target.value)}
              placeholder="Ej: Gran oferta de verano"
              style={{ width: "100%", padding: "0.4rem" }}
              required
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Enlace (opcional)</label>
            <input 
              type="text" 
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              placeholder="Ej: /productos/ofertas"
              style={{ width: "100%", padding: "0.4rem" }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem", lineHeight: 1.4 }}>
              El <strong>texto alternativo</strong> describe la imagen y no se ve. El <strong>titular</strong> sí se ve: lo escribe la aplicación encima del banner. Si lo dejás vacío, el banner se muestra tal cual lo subiste.
            </p>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Titular (opcional)</label>
            <input 
              type="text" 
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ej: 20% descuento"
              maxLength={60}
              style={{ width: "100%", padding: "0.4rem" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Bajada (opcional)</label>
            <input 
              type="text" 
              value={newSubtitle}
              onChange={(e) => setNewSubtitle(e.target.value)}
              placeholder="Ej: En todos los productos"
              maxLength={120}
              style={{ width: "100%", padding: "0.4rem" }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Botón (opcional)</label>
            <input 
              type="text" 
              value={newCtaLabel}
              onChange={(e) => setNewCtaLabel(e.target.value)}
              placeholder="Ej: Ver más"
              maxLength={30}
              style={{ width: "100%", padding: "0.4rem" }}
            />
          </div>
        </div>
        <button 
          type="submit" 
          className="btn-primary" 
          disabled={uploading}
          style={{ marginTop: "1rem", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
        >
          <Upload size={16} />
          {uploading ? "Subiendo..." : "Agregar Banner"}
        </button>
      </form>

      {/* List */}
      {isLoading ? (
        <p>Cargando banners...</p>
      ) : banners.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No hay banners cargados.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {banners.map((banner, index) => (
            <div 
              key={banner.id} 
              style={{ 
                display: "flex", 
                gap: "1rem", 
                padding: "1rem", 
                border: "1px solid var(--surface-border)", 
                borderRadius: "8px",
                alignItems: "center",
                opacity: banner.is_active ? 1 : 0.6
              }}
            >
              <img 
                src={
                  banner.image_url.startsWith("http")
                    ? banner.image_url
                    : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/company-assets/${banner.image_url}`
                }
                alt={banner.alt_text}
                style={{ width: "120px", height: "30px", objectFit: "cover", borderRadius: "4px" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{banner.title || banner.alt_text}</div>
                {banner.title && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{banner.alt_text}</div>}
                {banner.link_url && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Enlace: {banner.link_url}</div>}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button 
                  onClick={() => moveBanner(banner.id, index, 'up')}
                  disabled={index === 0}
                  className="btn btn-secondary"
                  title="Subir"
                  style={{ padding: "4px" }}
                >
                  <ArrowUp size={16} />
                </button>
                <button 
                  onClick={() => moveBanner(banner.id, index, 'down')}
                  disabled={index === banners.length - 1}
                  className="btn btn-secondary"
                  title="Bajar"
                  style={{ padding: "4px" }}
                >
                  <ArrowDown size={16} />
                </button>
                <button 
                  onClick={() => toggleActive(banner.id, banner.is_active)}
                  className="btn btn-secondary"
                  title={banner.is_active ? "Desactivar" : "Activar"}
                  style={{ padding: "4px" }}
                >
                  {banner.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button 
                  onClick={() => deleteBanner(banner.id, banner.image_url)}
                  className="btn btn-secondary"
                  title="Eliminar"
                  style={{ padding: "4px", color: "var(--danger)" }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
