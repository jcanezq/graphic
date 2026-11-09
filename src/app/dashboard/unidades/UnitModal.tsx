"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { X, Save } from "lucide-react";
import type { Unit } from "@/types";
import { useRouter } from "next/navigation";

export interface UnitWithCount extends Unit {
  productCount?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  unit?: UnitWithCount | null;
  onSuccess?: () => void;
}

export default function UnitModal({ isOpen, onClose, unit, onSuccess }: Props) {
  const supabase = createClient();
  const { showToast } = useToast();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (unit) {
      setCode(unit.code || "");
      setLabel(unit.label || "");
      setSortOrder(unit.sort_order ?? 1);
      setIsActive(unit.is_active ?? true);
    } else {
      setCode("");
      setLabel("");
      setSortOrder(1);
      setIsActive(true);
    }
  }, [unit, isOpen]);

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmedCode = code.trim();
    const trimmedLabel = label.trim();

    if (!trimmedCode) {
      showToast("El código de la unidad es obligatorio", "error");
      return;
    }
    if (!trimmedLabel) {
      showToast("La etiqueta de la unidad es obligatoria", "error");
      return;
    }

    // Advertencia al desactivar si la usan productos
    if (unit && unit.is_active && !isActive) {
      const count = unit.productCount ?? 0;
      if (count > 0) {
        const confirmed = window.confirm(
          `Esta unidad se usa en ${count} producto(s).\n` +
          `Al desactivarla, no aparecerá en los selectores para nuevos productos (los productos existentes la conservarán con la marca "(inactiva)").\n\n` +
          `¿Deseas desactivarla?`
        );
        if (!confirmed) return;
      }
    }

    setSaving(true);

    try {
      if (unit) {
        // UPDATE: sólo columnas editables según grant de BD: label, sort_order, is_active (code NO se edita)
        const { error } = await supabase
          .from("units")
          .update({
            label: trimmedLabel,
            sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
            is_active: isActive,
          })
          .eq("id", unit.id);

        if (error) throw error;
        showToast("Unidad actualizada correctamente");
      } else {
        // CREATE: verificar que code sea único
        const { data: existing, error: checkError } = await supabase
          .from("units")
          .select("id")
          .eq("code", trimmedCode)
          .limit(1);

        if (checkError) throw checkError;
        if (existing && existing.length > 0) {
          showToast(`Ya existe una unidad con el código "${trimmedCode}". Elige otro código.`, "error");
          setSaving(false);
          return;
        }

        const { error } = await supabase
          .from("units")
          .insert([
            {
              code: trimmedCode,
              label: trimmedLabel,
              sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
              is_active: isActive,
            },
          ]);

        if (error) throw error;
        showToast("Unidad creada exitosamente");
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
      <div className="modal-content" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>{unit ? "Editar Unidad" : "Nueva Unidad"}</h2>
          <button className="btn-icon" onClick={onClose} disabled={saving}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              Código {unit ? "(no editable)" : "*"}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: millar, m², kit, unidad"
              className="form-input"
              style={{
                width: "100%",
                fontFamily: "var(--font-mono)",
                background: unit ? "var(--surface-sunken)" : "var(--surface)",
                cursor: unit ? "not-allowed" : "text",
              }}
              disabled={Boolean(unit)}
              required
            />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
              {unit
                ? "El código se guarda en la base de datos y no se puede modificar para preservar la integridad referencial."
                : "Identificador interno exacto que se guardará en los productos (ej: m², unidad, millar)."}
            </span>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              Etiqueta visible *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: Millar (1000 unidades)"
              className="form-input"
              style={{ width: "100%" }}
              required
            />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
              Nombre descriptivo que se mostrará en los selectores y listas.
            </span>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              Orden de presentación
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              className="form-input"
              style={{ width: "100%" }}
              min={0}
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
                {isActive ? "Unidad activa" : "Unidad inactiva"}
              </span>
            </label>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
              Las unidades inactivas no se muestran en selectores al crear o editar productos nuevos. Los productos existentes que ya la utilicen la mostrarán con la marca «(inactiva)».
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? "Guardando..." : "Guardar Unidad"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

