"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency } from "@/lib/formatters";
import { calcMaterialCost, calcLaborCost, calcIndirectCost, calcUnitPrice } from "@/lib/calculations";
import { Save, ArrowLeft, Plus, Trash2, ChevronDown, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import type { Category, ProductMaterial, ProductLabor, ProductIndirectCost, ProductUnit, Material } from "@/types";

const UNITS: { value: ProductUnit; label: string }[] = [
  { value: "m²", label: "Metro cuadrado (m²)" },
  { value: "unidad", label: "Unidad" },
  { value: "kit", label: "Kit" },
  { value: "servicio", label: "Servicio" },
  { value: "ml", label: "Metro lineal (ml)" },
  { value: "metro", label: "Metro" },
];

export default function ProductFormPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const { showToast } = useToast();

  const isNew = params.id === "nuevo";
  const productId = isNew ? null : (params.id as string);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [masterMaterials, setMasterMaterials] = useState<Material[]>([]);

  // Form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"Producto" | "Servicio">("Producto");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState<ProductUnit>("unidad");
  const [manualCost, setManualCost] = useState<string>("");
  const [useManualCost, setUseManualCost] = useState(false);
  const [defaultMargin, setDefaultMargin] = useState(30);
  const [isActive, setIsActive] = useState(true);

  const [materials, setMaterials] = useState<ProductMaterial[]>([]);
  const [labor, setLabor] = useState<ProductLabor[]>([]);
  const [indirects, setIndirects] = useState<ProductIndirectCost[]>([]);

  // Collapsible sections
  const [openSections, setOpenSections] = useState({
    materials: true,
    labor: true,
    indirects: true,
  });

  useEffect(() => {
    fetchCategories();
    fetchMasterMaterials();
    if (productId) fetchProduct();
  }, [productId]);

  async function fetchMasterMaterials() {
    const { data } = await supabase.from("materials").select("*").order("name");
    setMasterMaterials((data as Material[]) || []);
  }

  async function fetchCategories() {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setCategories((data as Category[]) || []);
  }

  async function fetchProduct() {
    const [prodRes, matRes, labRes, indRes] = await Promise.all([
      supabase.from("products").select("*").eq("id", productId).single(),
      supabase.from("product_materials").select("*").eq("product_id", productId),
      supabase.from("product_labor").select("*").eq("product_id", productId),
      supabase.from("product_indirect_costs").select("*").eq("product_id", productId),
    ]);

    if (prodRes.data) {
      const p = prodRes.data;
      setCode(p.code);
      setName(p.name);
      setType(p.type || "Producto");
      setCategoryId(p.category_id || "");
      setDescription(p.description || "");
      setUnit(p.unit as ProductUnit);
      setManualCost(p.manual_unit_cost ? String(p.manual_unit_cost) : "");
      setUseManualCost(p.manual_unit_cost != null);
      setDefaultMargin(Number(p.default_margin));
      setIsActive(p.is_active);
    }

    setMaterials((matRes.data as ProductMaterial[]) || []);
    setLabor((labRes.data as ProductLabor[]) || []);
    setIndirects((indRes.data as ProductIndirectCost[]) || []);
    setLoading(false);
  }

  // Cost calculations
  const materialTotal = calcMaterialCost(materials);
  const laborTotal = calcLaborCost(labor);
  const indirectTotal = calcIndirectCost(indirects);
  const unitCost = useManualCost && manualCost ? Number(manualCost) : materialTotal + laborTotal + indirectTotal;
  const salePrice = calcUnitPrice(unitCost, defaultMargin);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code || !name) {
      showToast("Código y nombre son obligatorios", "error");
      return;
    }

    setSaving(true);

    const productData = {
      code,
      name,
      type,
      category_id: categoryId || null,
      description,
      unit,
      manual_unit_cost: useManualCost && manualCost ? Number(manualCost) : null,
      default_margin: defaultMargin,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    let savedId = productId;

    if (isNew) {
      const { data, error } = await supabase.from("products").insert(productData).select().single();
      if (error) {
        showToast("Error: " + error.message, "error");
        setSaving(false);
        return;
      }
      savedId = data.id;
    } else {
      const { error } = await supabase.from("products").update(productData).eq("id", productId);
      if (error) {
        showToast("Error: " + error.message, "error");
        setSaving(false);
        return;
      }
      // Delete existing related data to re-insert
      await Promise.all([
        supabase.from("product_materials").delete().eq("product_id", productId),
        supabase.from("product_labor").delete().eq("product_id", productId),
        supabase.from("product_indirect_costs").delete().eq("product_id", productId),
      ]);
    }

    // Insert related data
    if (materials.length > 0) {
      await supabase.from("product_materials").insert(
        materials.map((m) => ({
          product_id: savedId,
          material_id: m.material_id || null,
          name: m.name,
          quantity: Number(m.quantity),
          unit_cost: Number(m.unit_cost),
          unit: m.unit || "unidad",
        }))
      );
    }
    if (labor.length > 0) {
      await supabase.from("product_labor").insert(
        labor.map((l) => ({
          product_id: savedId,
          work_type: l.work_type,
          hours: Number(l.hours),
          hourly_rate: Number(l.hourly_rate),
        }))
      );
    }
    if (indirects.length > 0) {
      await supabase.from("product_indirect_costs").insert(
        indirects.map((ic) => ({
          product_id: savedId,
          concept: ic.concept,
          cost: Number(ic.cost),
        }))
      );
    }

    showToast(isNew ? "Producto creado exitosamente" : "Producto actualizado");
    setSaving(false);
    router.push("/dashboard/productos");
  }

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) {
    return (
      <div className="page-body">
        <div className="skeleton" style={{ height: 400, borderRadius: 14 }} />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/dashboard/productos" className="btn-icon">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1>{isNew ? "Nuevo Producto" : "Editar Producto"}</h1>
            <p className="subtitle">{isNew ? "Registra un nuevo producto o servicio" : code}</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        <form onSubmit={handleSubmit}>
          <div className="content-grid">
            {/* Left Column — Form */}
            <div>
              {/* Basic Info */}
              <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
                <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
                  Información Básica
                </h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Código *</label>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="EXH-001"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Unidad de medida</label>
                    <select value={unit} onChange={(e) => setUnit(e.target.value as ProductUnit)}>
                      {UNITS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Nombre del producto/servicio *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Exhibidor en acrílico"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo *</label>
                    <select value={type} onChange={(e) => setType(e.target.value as "Producto" | "Servicio")}>
                      <option value="Producto">Producto</option>
                      <option value="Servicio">Servicio</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Categoría</label>
                    <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                      <option value="">Sin categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Margen de utilidad (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={defaultMargin}
                      onChange={(e) => setDefaultMargin(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Descripción</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descripción detallada del producto o servicio..."
                    rows={3}
                  />
                </div>
                <div style={{ display: "flex", gap: "var(--space-xl)", alignItems: "center" }}>
                  <label className="toggle" style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <span className="toggle-track" />
                    Producto activo
                  </label>
                  <label className="toggle" style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={useManualCost}
                      onChange={(e) => setUseManualCost(e.target.checked)}
                    />
                    <span className="toggle-track" />
                    Costo manual
                  </label>
                </div>
                {useManualCost && (
                  <div className="form-group" style={{ marginTop: "var(--space-md)" }}>
                    <label>Costo unitario manual (S/)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={manualCost}
                      onChange={(e) => setManualCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>

              {/* Materials */}
              <div className="section-collapsible">
                <div
                  className={`section-header ${openSections.materials ? "open" : ""}`}
                  onClick={() => toggleSection("materials")}
                >
                  <h3>🧱 Materiales / Insumos ({materials.length})</h3>
                  <ChevronDown size={18} />
                </div>
                {openSections.materials && (
                  <div className="section-body">
                    {materials.length > 0 && (
                      <table className="cost-table">
                        <thead>
                          <tr>
                            <th>Material</th>
                            <th style={{ width: 100 }}>Cantidad</th>
                            <th style={{ width: 120 }}>Costo Unit. (S/)</th>
                            <th style={{ width: 100 }}>Subtotal</th>
                            <th className="row-actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {materials.map((m, i) => (
                            <tr key={i}>
                              <td>
                                <select
                                  value={m.material_id || ""}
                                  onChange={(e) => {
                                    const selectedId = e.target.value;
                                    const selectedMat = masterMaterials.find(x => x.id === selectedId);
                                    const arr = [...materials];
                                    if (selectedMat) {
                                      arr[i] = { 
                                        ...arr[i], 
                                        material_id: selectedMat.id, 
                                        name: selectedMat.name,
                                        unit: selectedMat.unit,
                                        unit_cost: selectedMat.cost 
                                      };
                                    } else {
                                      arr[i] = { ...arr[i], material_id: null, name: "" };
                                    }
                                    setMaterials(arr);
                                  }}
                                  style={{ width: "100%" }}
                                >
                                  <option value="">Seleccionar material...</option>
                                  {masterMaterials.map(mat => (
                                    <option key={mat.id} value={mat.id}>{mat.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={m.quantity}
                                  onChange={(e) => {
                                    const arr = [...materials];
                                    arr[i] = { ...arr[i], quantity: Number(e.target.value) };
                                    setMaterials(arr);
                                  }}
                                />
                              </td>
                              <td>
                                <div style={{ padding: "0 8px", color: "var(--text-secondary)" }}>
                                  {formatCurrency(m.unit_cost)}
                                </div>
                              </td>
                              <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                                {formatCurrency(m.quantity * m.unit_cost)}
                              </td>
                              <td className="row-actions">
                                <button
                                  type="button"
                                  className="btn-icon"
                                  style={{ color: "var(--error)", width: 28, height: 28 }}
                                  onClick={() => setMaterials(materials.filter((_, j) => j !== i))}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <button
                      type="button"
                      className="add-row-btn"
                      onClick={() =>
                        setMaterials([...materials, { name: "", material_id: null, quantity: 1, unit_cost: 0, unit: "unidad" }])
                      }
                    >
                      <Plus size={14} /> Agregar material
                    </button>
                  </div>
                )}
              </div>

              {/* Labor */}
              <div className="section-collapsible">
                <div
                  className={`section-header ${openSections.labor ? "open" : ""}`}
                  onClick={() => toggleSection("labor")}
                >
                  <h3>👷 Mano de Obra ({labor.length})</h3>
                  <ChevronDown size={18} />
                </div>
                {openSections.labor && (
                  <div className="section-body">
                    {labor.length > 0 && (
                      <table className="cost-table">
                        <thead>
                          <tr>
                            <th>Tipo de trabajo</th>
                            <th style={{ width: 100 }}>Horas</th>
                            <th style={{ width: 120 }}>S/ por hora</th>
                            <th style={{ width: 100 }}>Subtotal</th>
                            <th className="row-actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {labor.map((l, i) => (
                            <tr key={i}>
                              <td>
                                <input
                                  value={l.work_type}
                                  onChange={(e) => {
                                    const arr = [...labor];
                                    arr[i] = { ...arr[i], work_type: e.target.value };
                                    setLabor(arr);
                                  }}
                                  placeholder="Instalación"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  value={l.hours}
                                  onChange={(e) => {
                                    const arr = [...labor];
                                    arr[i] = { ...arr[i], hours: Number(e.target.value) };
                                    setLabor(arr);
                                  }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={l.hourly_rate}
                                  onChange={(e) => {
                                    const arr = [...labor];
                                    arr[i] = { ...arr[i], hourly_rate: Number(e.target.value) };
                                    setLabor(arr);
                                  }}
                                />
                              </td>
                              <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                                {formatCurrency(l.hours * l.hourly_rate)}
                              </td>
                              <td className="row-actions">
                                <button
                                  type="button"
                                  className="btn-icon"
                                  style={{ color: "var(--error)", width: 28, height: 28 }}
                                  onClick={() => setLabor(labor.filter((_, j) => j !== i))}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <button
                      type="button"
                      className="add-row-btn"
                      onClick={() =>
                        setLabor([...labor, { work_type: "", hours: 1, hourly_rate: 0 }])
                      }
                    >
                      <Plus size={14} /> Agregar mano de obra
                    </button>
                  </div>
                )}
              </div>

              {/* Indirect Costs */}
              <div className="section-collapsible">
                <div
                  className={`section-header ${openSections.indirects ? "open" : ""}`}
                  onClick={() => toggleSection("indirects")}
                >
                  <h3>📦 Costos Indirectos ({indirects.length})</h3>
                  <ChevronDown size={18} />
                </div>
                {openSections.indirects && (
                  <div className="section-body">
                    {indirects.length > 0 && (
                      <table className="cost-table">
                        <thead>
                          <tr>
                            <th>Concepto</th>
                            <th style={{ width: 140 }}>Costo (S/)</th>
                            <th className="row-actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {indirects.map((ic, i) => (
                            <tr key={i}>
                              <td>
                                <input
                                  value={ic.concept}
                                  onChange={(e) => {
                                    const arr = [...indirects];
                                    arr[i] = { ...arr[i], concept: e.target.value };
                                    setIndirects(arr);
                                  }}
                                  placeholder="Transporte"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={ic.cost}
                                  onChange={(e) => {
                                    const arr = [...indirects];
                                    arr[i] = { ...arr[i], cost: Number(e.target.value) };
                                    setIndirects(arr);
                                  }}
                                />
                              </td>
                              <td className="row-actions">
                                <button
                                  type="button"
                                  className="btn-icon"
                                  style={{ color: "var(--error)", width: 28, height: 28 }}
                                  onClick={() => setIndirects(indirects.filter((_, j) => j !== i))}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <button
                      type="button"
                      className="add-row-btn"
                      onClick={() =>
                        setIndirects([...indirects, { concept: "", cost: 0 }])
                      }
                    >
                      <Plus size={14} /> Agregar costo indirecto
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column — Cost Summary */}
            <div>
              <div className="cost-breakdown" style={{ position: "sticky", top: 90 }}>
                <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
                  Resumen de Costos
                </h3>
                <div className="cost-breakdown-row">
                  <span>Materiales</span>
                  <span>{formatCurrency(materialTotal)}</span>
                </div>
                <div className="cost-breakdown-row">
                  <span>Mano de obra</span>
                  <span>{formatCurrency(laborTotal)}</span>
                </div>
                <div className="cost-breakdown-row">
                  <span>Costos indirectos</span>
                  <span>{formatCurrency(indirectTotal)}</span>
                </div>
                <div className="cost-breakdown-row total">
                  <span>Costo Unitario</span>
                  <span>{formatCurrency(unitCost)}</span>
                </div>
                <div className="cost-breakdown-row" style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  <span>Margen ({defaultMargin}%)</span>
                  <span>+ {formatCurrency(unitCost * defaultMargin / 100)}</span>
                </div>
                <div className="cost-breakdown-row grand-total">
                  <span>Precio Venta</span>
                  <span>{formatCurrency(salePrice)}</span>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                  style={{ width: "100%", marginTop: "var(--space-lg)" }}
                  onClick={handleSubmit}
                >
                  <Save size={16} />
                  {saving ? "Guardando..." : isNew ? "Crear Producto" : "Guardar Cambios"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
