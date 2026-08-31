"use client";

import { useEffect, useState, useMemo } from "react";
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
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [prodRes, catRes] = await Promise.all([
      supabase
        .from("products")
        .select("*, categories(id, name, color, slug)")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order"),
    ]);

    if (prodRes.data) {
      // Fetch materials, labor, indirects for cost calculation
      const productIds = prodRes.data.map((p: Product) => p.id);
      const [matRes, labRes, indRes] = await Promise.all([
        supabase.from("product_materials").select("*").in("product_id", productIds),
        supabase.from("product_labor").select("*").in("product_id", productIds),
        supabase.from("product_indirect_costs").select("*").in("product_id", productIds),
      ]);

      const productsWithCosts = prodRes.data.map((p: Record<string, unknown>) => {
        const materials = (matRes.data || []).filter((m: { product_id: string }) => m.product_id === p.id);
        const labor = (labRes.data || []).filter((l: { product_id: string }) => l.product_id === p.id);
        const indirect_costs = (indRes.data || []).filter((ic: { product_id: string }) => ic.product_id === p.id);

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
      });

      setProducts(productsWithCosts as Product[]);
    }

    setCategories((catRes.data as Category[]) || []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este producto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      showToast("Error al eliminar producto", "error");
    } else {
      showToast("Producto eliminado");
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  }

  async function handleDuplicate(product: Product) {
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

    if (error) {
      showToast("Error al duplicar: " + error.message, "error");
      return;
    }

    if (data && product.materials?.length) {
      await supabase.from("product_materials").insert(
        product.materials.map((m) => ({
          product_id: data.id,
          name: m.name,
          quantity: m.quantity,
          unit_cost: m.unit_cost,
          unit: m.unit,
        }))
      );
    }
    if (data && product.labor?.length) {
      await supabase.from("product_labor").insert(
        product.labor.map((l) => ({
          product_id: data.id,
          work_type: l.work_type,
          hours: l.hours,
          hourly_rate: l.hourly_rate,
        }))
      );
    }
    if (data && product.indirect_costs?.length) {
      await supabase.from("product_indirect_costs").insert(
        product.indirect_costs.map((ic) => ({
          product_id: data.id,
          concept: ic.concept,
          cost: ic.cost,
        }))
      );
    }

    showToast("Producto duplicado correctamente");
    fetchData();
  }

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !categoryFilter || p.category_id === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

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
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Unidad</th>
                  <th>Costo Unit.</th>
                  <th>P.V. (c/margen)</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const unitCost = p.computed_unit_cost || 0;
                  const salePrice = unitCost * (1 + p.default_margin / 100);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                        {p.code}
                      </td>
                      <td className="primary">{p.name}</td>
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
        )}
      </div>
    </div>
  );
}
