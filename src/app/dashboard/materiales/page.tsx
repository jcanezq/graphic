"use client";

import { useState, useMemo } from "react";
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

  const { data: materials = [], isLoading: loading } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data } = await supabase
        .from("materials")
        .select("*")
        .order("name", { ascending: true });
      return (data as Material[]) || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      showToast("Material eliminado");
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
    onError: (e: any) => showToast("Error al eliminar material: " + e.message, "error")
  });

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este material?")) return;
    deleteMutation.mutate(id);
  }

  const [search, setSearch] = useState("");
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

  const filtered = useMemo(() => {
    return materials.filter((m) =>
      !search || m.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [materials, search]);

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Catálogo de Materiales</h1>
          <p className="subtitle">{materials.length} materiales registrados</p>
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
          <div className="card" style={{ padding: "2rem" }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 48, marginBottom: 8, borderRadius: 8 }}
              />
            ))}
          </div>
        ) : filtered.length === 0 && editingId !== "new" ? (
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
                {filtered.map((m) => {
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
      </div>
    </div>
  );
}
