"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { Search, Tags, Edit2, CheckCircle2, XCircle } from "lucide-react";
import CategoryModal, { type CategoryWithCount } from "./CategoryModal";

interface Props {
  initialCategories: CategoryWithCount[];
}

export default function CategoryTable({ initialCategories }: Props) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState(initialCategories);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const supabase = createClient();
  const { showToast } = useToast();
  const PAGE_SIZE = 20;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<CategoryWithCount | null>(null);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.slug.toLowerCase().includes(s)
    );
  }, [categories, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  async function handleToggleActive(category: CategoryWithCount) {
    const nextActive = !category.is_active;

    if (!nextActive && (category.productCount ?? 0) > 0) {
      const confirmed = window.confirm(
        `Esta categoría tiene ${category.productCount} producto(s) asignado(s).\n` +
        `Al desactivarla, no aparecerá en los selectores para nuevos productos ni en los filtros del catálogo público.\n\n` +
        `¿Deseas desactivarla?`
      );
      if (!confirmed) return;
    }

    const { error } = await supabase
      .from("categories")
      .update({ is_active: nextActive })
      .eq("id", category.id);

    if (error) {
      showToast("Error al cambiar estado: " + error.message, "error");
    } else {
      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? { ...c, is_active: nextActive } : c))
      );
      showToast(
        nextActive
          ? `Categoría "${category.name}" activada`
          : `Categoría "${category.name}" desactivada`
      );
    }
  }

  function handleSuccess() {
    // La recarga o router.refresh traerá la lista actualizada
  }

  return (
    <>
      <div className="toolbar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o slug..."
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
            setCategoryToEdit(null);
            setIsModalOpen(true);
          }}
        >
          + Nueva Categoría
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="card empty-state">
          <Tags size={48} />
          <h3>No hay categorías registradas</h3>
          <p>Crea la primera categoría para organizar los productos del catálogo.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <Search size={48} />
          <h3>Sin resultados</h3>
          <p>No se encontraron categorías que coincidan con &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Slug</th>
                  <th style={{ textAlign: "center" }}>Productos</th>
                  <th style={{ textAlign: "center" }}>Estado</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((cat) => (
                  <tr key={cat.id} style={{ opacity: cat.is_active ? 1 : 0.65 }}>
                    <td className="primary">
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        {cat.color && (
                          <span
                            style={{
                              display: "inline-block",
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              background: cat.color,
                              flexShrink: 0,
                              border: "1px solid rgba(0,0,0,0.1)",
                            }}
                            title={`Color: ${cat.color}`}
                          />
                        )}
                        <span style={{ fontWeight: 600 }}>{cat.name}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      {cat.slug}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className="badge"
                        style={{
                          background: (cat.productCount ?? 0) > 0 ? "var(--accent-light)" : "var(--surface-sunken)",
                          color: (cat.productCount ?? 0) > 0 ? "var(--accent)" : "var(--text-muted)",
                        }}
                      >
                        {cat.productCount ?? 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {cat.is_active ? (
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
                            color: cat.is_active ? "var(--text-secondary)" : "var(--success)",
                          }}
                          title={cat.is_active ? "Desactivar categoría" : "Activar categoría"}
                          onClick={() => handleToggleActive(cat)}
                        >
                          {cat.is_active ? (
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
                          title="Editar categoría"
                          onClick={() => {
                            setCategoryToEdit(cat);
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
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} categorías
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

      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        category={categoryToEdit}
        onSuccess={handleSuccess}
      />
    </>
  );
}

