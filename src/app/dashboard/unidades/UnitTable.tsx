"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { Search, Ruler, Edit2, CheckCircle2, XCircle } from "lucide-react";
import UnitModal, { type UnitWithCount } from "./UnitModal";

interface Props {
  initialUnits: UnitWithCount[];
}

export default function UnitTable({ initialUnits }: Props) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [units, setUnits] = useState(initialUnits);

  useEffect(() => {
    setUnits(initialUnits);
  }, [initialUnits]);

  const supabase = createClient();
  const { showToast } = useToast();
  const PAGE_SIZE = 20;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<UnitWithCount | null>(null);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return units;
    return units.filter(
      (u) =>
        u.code.toLowerCase().includes(s) ||
        u.label.toLowerCase().includes(s)
    );
  }, [units, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  async function handleToggleActive(unit: UnitWithCount) {
    const nextActive = !unit.is_active;

    if (!nextActive && (unit.productCount ?? 0) > 0) {
      const confirmed = window.confirm(
        `Esta unidad se usa en ${unit.productCount} producto(s).\n` +
        `Al desactivarla, no aparecerá en los selectores para nuevos productos.\n\n` +
        `¿Deseas desactivarla?`
      );
      if (!confirmed) return;
    }

    const { error } = await supabase
      .from("units")
      .update({ is_active: nextActive })
      .eq("id", unit.id);

    if (error) {
      showToast("Error al cambiar estado: " + error.message, "error");
    } else {
      setUnits((prev) =>
        prev.map((u) => (u.id === unit.id ? { ...u, is_active: nextActive } : u))
      );
      showToast(
        nextActive
          ? `Unidad "${unit.label}" activada`
          : `Unidad "${unit.label}" desactivada`
      );
    }
  }

  function handleSuccess() {
    // La lista se actualiza
  }

  return (
    <>
      <div className="toolbar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por código o etiqueta..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setUnitToEdit(null);
            setIsModalOpen(true);
          }}
        >
          + Nueva Unidad
        </button>
      </div>

      {units.length === 0 ? (
        <div className="card empty-state">
          <Ruler size={48} />
          <h3>No hay unidades registradas</h3>
          <p>Crea las unidades de medida que utilizarán los productos y servicios.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <Search size={48} />
          <h3>Sin resultados</h3>
          <p>No se encontraron unidades que coincidan con &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Etiqueta descriptiva</th>
                  <th style={{ textAlign: "center" }}>Orden</th>
                  <th style={{ textAlign: "center" }}>Productos</th>
                  <th style={{ textAlign: "center" }}>Estado</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((unit) => (
                  <tr key={unit.id} style={{ opacity: unit.is_active ? 1 : 0.65 }}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>
                      {unit.code}
                    </td>
                    <td className="primary">
                      <span>{unit.label}</span>
                    </td>
                    <td style={{ textAlign: "center", fontSize: "0.85rem" }}>
                      {unit.sort_order ?? 0}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className="badge"
                        style={{
                          background: (unit.productCount ?? 0) > 0 ? "var(--accent-light)" : "var(--surface-sunken)",
                          color: (unit.productCount ?? 0) > 0 ? "var(--accent)" : "var(--text-muted)",
                        }}
                      >
                        {unit.productCount ?? 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {unit.is_active ? (
                        <span className="badge badge-success">Activa</span>
                      ) : (
                        <span className="badge badge-warning">Inactiva</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{
                            fontSize: "0.8rem",
                            padding: "4px 8px",
                            color: unit.is_active ? "var(--text-secondary)" : "var(--success)",
                          }}
                          title={unit.is_active ? "Desactivar unidad" : "Activar unidad"}
                          onClick={() => handleToggleActive(unit)}
                        >
                          {unit.is_active ? (
                            <>
                              <XCircle size={14} style={{ marginRight: 4 }} /> Desactivar
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} style={{ marginRight: 4 }} /> Activar
                            </>
                          )}
                        </button>
                        <button
                          className="btn-icon"
                          title="Editar unidad"
                          onClick={() => {
                            setUnitToEdit(unit);
                            setIsModalOpen(true);
                          }}
                        >
                          <Edit2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderTop: "1px solid var(--surface-divider)",
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
              }}
            >
              <span>
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} unidades
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  ← Anterior
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <UnitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        unit={unitToEdit}
        onSuccess={handleSuccess}
      />
    </>
  );
}

