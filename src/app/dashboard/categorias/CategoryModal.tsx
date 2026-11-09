"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { X, Save, Tag } from "lucide-react";
import type { Category } from "@/types";
import { useRouter } from "next/navigation";
import { slugifyCategory } from "@/lib/maintainers";

export interface CategoryWithCount extends Category {
  productCount?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  category?: CategoryWithCount | null;
  onSuccess?: () => void;
}

export default function CategoryModal({ isOpen, onClose, category, onSuccess }: Props) {
  const supabase = createClient();
  const { showToast } = useToast();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [icon, setIcon] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name || "");
      setSlug(category.slug || "");
      setColor(category.color || "#3b82f6");
      setIcon(category.icon || "");
      setIsActive(category.is_active ?? true);
      setSlugManuallyEdited(true);
    } else {
      setName("");
      setSlug("");
      setColor("#3b82f6");
      setIcon("");
      setIsActive(true);
      setSlugManuallyEdited(false);
    }
  }, [category, isOpen]);

  // Si es nueva categoría y el usuario escribe el nombre, generar slug automáticamente
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setName(val);
    if (!category && !slugManuallyEdited) {
      setSlug(slugifyCategory(val));
    }
  }

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast("El nombre de la categoría es obligatorio", "error");
      return;
    }

    const finalSlug = category ? category.slug : (slug.trim() || slugifyCategory(trimmedName));
    if (!finalSlug) {
      showToast("El slug es obligatorio", "error");
      return;
    }

    // Advertencia al desactivar si tiene productos asociados
    if (category && category.is_active && !isActive) {
      const count = category.productCount ?? 0;
      if (count > 0) {
        const confirmed = window.confirm(
          `Esta categoría tiene ${count} producto(s) asignado(s).\n` +
          `Al desactivarla, no aparecerá en los selectores de nuevos productos ni en los filtros del catálogo público (sus productos existentes seguirán visibles).\n\n` +
          `¿Deseas desactivarla?`
        );
        if (!confirmed) return;
      }
    }

    setSaving(true);

    try {
      if (category) {
        // UPDATE: sólo columnas editables según grant de BD: name, color, icon, is_active
        const { error } = await supabase
          .from("categories")
          .update({
            name: trimmedName,
            color: color || null,
            icon: icon.trim() || null,
            is_active: isActive,
          })
          .eq("id", category.id);

        if (error) throw error;
        showToast("Categoría actualizada correctamente");
      } else {
        // CREATE: verificar que slug sea único
        const { data: existing, error: checkError } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", finalSlug)
          .limit(1);

        if (checkError) throw checkError;
        if (existing && existing.length > 0) {
          showToast(`Ya existe una categoría con el slug "${finalSlug}". Elige otro nombre o slug.`, "error");
          setSaving(false);
          return;
        }

        const { error } = await supabase
          .from("categories")
          .insert([
            {
              name: trimmedName,
              slug: finalSlug,
              color: color || null,
              icon: icon.trim() || null,
              is_active: isActive,
            },
          ]);

        if (error) throw error;
        showToast("Categoría creada exitosamente");
      }

      if (onSuccess) onSuccess();
      onClose();
      router.refresh();
    } catch (err: any) {
      showToast("Error al guardar: " + (err.message || err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2>{category ? "Editar Categoría" : "Nueva Categoría"}</h2>
          <button className="btn-icon" onClick={onClose} disabled={saving}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              Nombre de la categoría *
            </label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="Ej: Impresión Digital"
              className="form-input"
              style={{ width: "100%" }}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              Slug (identificador URL) {category ? "(no editable)" : "*"}
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(slugifyCategory(e.target.value));
                setSlugManuallyEdited(true);
              }}
              placeholder="ej: impresion-digital"
              className="form-input"
              style={{
                width: "100%",
                fontFamily: "var(--font-mono)",
                background: category ? "var(--surface-sunken)" : "var(--surface)",
                cursor: category ? "not-allowed" : "text",
              }}
              disabled={Boolean(category)}
              required
            />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
              {category
                ? "El slug se fijó al crear la categoría y no puede modificarse para proteger URLs y banners existentes."
                : "Se genera automáticamente desde el nombre y se usará en enlaces del catálogo."}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                Color identificador
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: "40px",
                    height: "38px",
                    padding: 0,
                    border: "1px solid var(--surface-divider)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    background: "transparent",
                  }}
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="form-input"
                  style={{ flex: 1, fontFamily: "var(--font-mono)" }}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              Ícono (opcional)
            </label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="tag, layers, print, box..."
              className="form-input"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ paddingTop: "0.5rem", borderTop: "1px solid var(--surface-divider)" }}>
            <label className="toggle" style={{ marginBottom: 0, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span className="toggle-track" />
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                {isActive ? "Categoría activa" : "Categoría inactiva"}
              </span>
            </label>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
              Las categorías inactivas no aparecen en los selectores de productos nuevos ni en los filtros del catálogo público.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? "Guardando..." : "Guardar Categoría"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

