"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency } from "@/lib/formatters";
import { calcUnitCost } from "@/lib/calculations";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Package,
} from "lucide-react";
import Link from "next/link";
import type { Product, Category } from "@/types";

export default function ProductsPage() {
  const supabase = createClient();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      return (data as Category[]) || [];
    }
  });

  const { data: products = [], isLoading: loading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data: prodRes } = await supabase
        .from("products")
        .select("*, categories(id, name, color, slug)")
        .order("created_at", { ascending: false });

      if (!prodRes) return [];

      const productIds = prodRes.map((p: Product) => p.id);
      const [matRes, labRes, indRes] = await Promise.all([
        supabase.from("product_materials").select("*").in("product_id", productIds),
        supabase.from("product_labor").select("*").in("product_id", productIds),
        supabase.from("product_indirect_costs").select("*").in("product_id", productIds),
      ]);

      return prodRes.map((p: any) => {
        const materials = (matRes.data || []).filter((m: any) => m.product_id === p.id);
        const labor = (labRes.data || []).filter((l: any) => l.product_id === p.id);
        const indirect_costs = (indRes.data || []).filter((ic: any) => ic.product_id === p.id);

        return {
          ...p,
          category: p.categories,
          materials,
          labor,
          indirect_costs,
          computed_unit_cost: calcUnitCost({
            manual_unit_cost: p.manual_unit_cost as number | null,
            materials,
            labor,
            indirect_costs,
          }),
        };
      }) as Product[];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      showToast("Producto eliminado");
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => showToast("Error al eliminar producto", "error")
  });

  const duplicateMutation = useMutation({
    mutationFn: async (product: Product) => {
      const newCode = product.code + "-COPIA";
      const { data, error } = await supabase
        .from("products")
        .insert({
          code: newCode,
          name: product.name + " (Copia)",
          category_id: product.category_id,
          description: product.description,
          unit: product.unit,
          manual_unit_cost: product.manual_unit_cost,
          default_margin: product.default_margin,
          is_active: product.is_active,
        })
        .select()
        .single();

      if (error) throw error;

      if (data && product.materials?.length) {
        await supabase.from("product_materials").insert(
          product.materials.map((m) => ({ ...m, id: undefined, product_id: data.id }))
        );
      }
      if (data && product.labor?.length) {
        await supabase.from("product_labor").insert(
          product.labor.map((l) => ({ ...l, id: undefined, product_id: data.id }))
        );
      }
      if (data && product.indirect_costs?.length) {
        await supabase.from("product_indirect_costs").insert(
          product.indirect_costs.map((ic) => ({ ...ic, id: undefined, product_id: data.id }))
        );
      }
    },
    onSuccess: () => {
      showToast("Producto duplicado correctamente");
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: any) => showToast("Error al duplicar: " + e.message, "error")
  });

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este producto?")) return;
    deleteMutation.mutate(id);
  }

  async function handleDuplicate(product: Product) {
    duplicateMutation.mutate(product);
  }

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const PAGE_SIZE = 15;

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !categoryFilter || p.category_id === categoryFilter;
      const matchesType = !typeFilter || p.type === typeFilter;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [products, search, categoryFilter, typeFilter]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, categoryFilter, typeFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedProducts = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Productos & Servicios</h1>
          <p className="subtitle">{products.length} productos registrados</p>
        </div>
        <div className="page-header-actions">
          <Link href="/dashboard/productos/nuevo" className="btn btn-primary">
            <Plus size={18} />
            Nuevo Producto
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="">Todos los tipos</option>
            <option value="Producto">Producto</option>
            <option value="Servicio">Servicio</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: 220 }}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
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
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <Package size={48} />
            <h3>No se encontraron productos</h3>
            <p>
              {search || categoryFilter
                ? "Prueba con otros filtros de búsqueda."
                : "Crea tu primer producto para empezar a cotizar."}
            </p>
            {!search && !categoryFilter && (
              <Link href="/dashboard/productos/nuevo" className="btn btn-primary">
                <Plus size={16} />
                Nuevo Producto
              </Link>
            )}
          </div>
        ) : (
          <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Unidad</th>
                  <th>Costo Unit.</th>
                  <th>P.V. (c/margen)</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((p) => {
                  const unitCost = p.computed_unit_cost || 0;
                  const salePrice = unitCost * (1 + p.default_margin / 100);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                        {p.code}
                      </td>
                      <td className="primary">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              onClick={() => setSelectedImage(p.image_url || null)}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: "var(--radius-sm)",
                                objectFit: "cover",
                                flexShrink: 0,
                                border: "1px solid var(--surface-border)",
                                cursor: "pointer",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: "var(--radius-sm)",
                                background: "var(--bg-tertiary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                border: "1px solid var(--surface-border)",
                              }}
                            >
                              <Package size={18} style={{ color: "var(--text-muted)" }} />
                            </div>
                          )}
                          <span>{p.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-muted">
                          {p.type || "Producto"}
                        </span>
                      </td>
                      <td>
                        {p.category && (
                          <span
                            className="badge"
                            style={{
                              background: `${p.category.color}20`,
                              color: p.category.color,
                            }}
                          >
                            {p.category.name}
                          </span>
                        )}
                      </td>
                      <td>{p.unit}</td>
                      <td>{formatCurrency(unitCost)}</td>
                      <td style={{ fontWeight: 600, color: "var(--success)" }}>
                        {formatCurrency(salePrice)}
                      </td>
                      <td>
                        <span className={`badge ${p.is_active ? "badge-success" : "badge-muted"}`}>
                          {p.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <Link href={`/dashboard/productos/${p.id}`} className="btn-icon" title="Editar">
                            <Edit2 size={15} />
                          </Link>
                          <button
                            className="btn-icon"
                            title="Duplicar"
                            onClick={() => handleDuplicate(p)}
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            className="btn-icon"
                            title="Eliminar"
                            onClick={() => handleDelete(p.id)}
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
            }}>
              <span>
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} productos
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
          </>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Vista previa"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              borderRadius: "var(--radius-md)",
              objectFit: "contain",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            }}
          />
        </div>
      )}
    </div>
  );
}
