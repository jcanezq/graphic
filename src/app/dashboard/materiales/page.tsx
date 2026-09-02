"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency } from "@/lib/formatters";
import { Plus, Search, Edit2, Trash2, Layers } from "lucide-react";
import type { Material } from "@/types";

export default function MaterialsPage() {
  const supabase = createClient();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const PAGE_SIZE = 15;
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch]);

  const { data: queryData, isLoading: loading } = useQuery({
    queryKey: ['materials', currentPage, debouncedSearch],
    queryFn: async () => {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("materials")
        .select("*", { count: 'exact' })
        .is("deleted_at", null);

      if (debouncedSearch) {
        query = query.ilike("name", `%${debouncedSearch}%`);
      }

      const { data, count } = await query
        .order("name", { ascending: true })
        .range(from, to);

      return { materials: (data as Material[]) || [], count: count || 0 };
    }
  });

  const materials = queryData?.materials || [];
  const totalItems = queryData?.count || 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['materials'] });
      const previousData = queryClient.getQueryData(['materials', currentPage, debouncedSearch]);
      queryClient.setQueryData(['materials', currentPage, debouncedSearch], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          materials: old.materials.filter((m: Material) => m.id !== deletedId),
          count: old.count - 1
        };
      });
      return { previousData };
    },
    onError: (err, newTodo, context) => {
      showToast("Error al eliminar material", "error");
      if (context?.previousData) {
        queryClient.setQueryData(['materials', currentPage, debouncedSearch], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
    onSuccess: () => {
      showToast("Material eliminado");
    }
  });

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este material?")) return;
    deleteMutation.mutate(id);
  }
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("unidad");
  const [editCost, setEditCost] = useState(0);

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; name: string; unit: string; cost: number }) => {
      if (data.id) {
        const { error } = await supabase.from("materials").update(data).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("materials").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showToast(editingId ? "Material actualizado" : "Material creado");
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setEditingId(null);
      setEditName("");
      setEditCost(0);
      setEditUnit("unidad");
    },
    onError: (e: any) => showToast("Error al guardar: " + e.message, "error")
  });

  function handleSave() {
    if (!editName) {
      showToast("El nombre es requerido", "error");
      return;
    }
    saveMutation.mutate({
      id: editingId === "new" ? undefined : editingId!,
      name: editName,
      unit: editUnit,
      cost: editCost
    });
  }

  function startEdit(m: Material) {
    setEditingId(m.id);
    setEditName(m.name);
    setEditUnit(m.unit);
    setEditCost(m.cost);
  }

  function startNew() {
    setEditingId("new");
    setEditName("");
    setEditUnit("unidad");
    setEditCost(0);
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Catálogo de Materiales</h1>
          <p className="subtitle">{totalItems} materiales registrados</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={startNew}>
            <Plus size={18} />
            Nuevo Material
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="toolbar">
          <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Unidad</th>
                  <th>Costo Unit.</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td><div className="skeleton" style={{ height: 24, width: "60%", borderRadius: 4 }} /></td>
                    <td><div className="skeleton" style={{ height: 20, width: 40, borderRadius: 4 }} /></td>
                    <td><div className="skeleton" style={{ height: 20, width: 60, borderRadius: 4 }} /></td>
                    <td><div className="skeleton" style={{ height: 28, width: 80, borderRadius: 4, marginLeft: "auto" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : materials.length === 0 && editingId !== "new" ? (
          <div className="card empty-state">
            <Layers size={48} />
            <h3>No se encontraron materiales</h3>
            <p>
              {search
                ? "Prueba con otros términos de búsqueda."
                : "Agrega tu primer material al catálogo."}
            </p>
            {!search && (
              <button className="btn btn-primary" onClick={startNew}>
                <Plus size={16} />
                Nuevo Material
              </button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Unidad</th>
                  <th>Costo Unit.</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {editingId === "new" && (
                  <tr>
                    <td>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Nombre del material"
                        autoFocus
                      />
                    </td>
                    <td>
                      <input
                        value={editUnit}
                        onChange={e => setEditUnit(e.target.value)}
                        placeholder="unidad"
                        style={{ width: 100 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={editCost}
                        onChange={e => setEditCost(Number(e.target.value))}
                        style={{ width: 100 }}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saveMutation.isPending}>
                          Guardar
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {materials.map((m) => {
                  if (editingId === m.id) {
                    return (
                      <tr key={m.id}>
                        <td>
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            value={editUnit}
                            onChange={e => setEditUnit(e.target.value)}
                            style={{ width: 100 }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={editCost}
                            onChange={e => setEditCost(Number(e.target.value))}
                            style={{ width: 100 }}
                          />
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saveMutation.isPending}>
                              Guardar
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={m.id}>
                      <td className="primary">{m.name}</td>
                      <td>{m.unit}</td>
                      <td>{formatCurrency(m.cost)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button
                            className="btn-icon"
                            title="Editar"
                            onClick={() => startEdit(m)}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="btn-icon"
                            title="Eliminar"
                            onClick={() => handleDelete(m.id)}
                            style={{ color: "var(--error)" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderTop: "1px solid var(--surface-divider)",
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            background: "var(--surface)",
            borderBottomLeftRadius: "var(--radius-lg)",
            borderBottomRightRadius: "var(--radius-lg)",
          }}>
            <span>
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalItems)} de {totalItems} materiales
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                ← Anterior
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) {
                  page = i + 1;
                } else if (currentPage <= 4) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  page = totalPages - 6 + i;
                } else {
                  page = currentPage - 3 + i;
                }
                return (
                  <button
                    key={page}
                    className={`btn btn-sm ${page === currentPage ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setCurrentPage(page)}
                    style={{ minWidth: 36 }}
                  >
                    {page}
                  </button>
                );
              })}
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
    </div>
  );
}
