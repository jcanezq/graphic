import { useFieldArray, Control } from "react-hook-form";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { Material } from "@/types";
import type { ProductFormValues } from "@/lib/validations/product";
import { useState } from "react";

interface Props {
  control: Control<ProductFormValues>;
  masterMaterials: Material[];
}

export function MaterialsSection({ control, masterMaterials }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "materials"
  });

  return (
    <div className="section-collapsible">
      <div
        className={`section-header ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3>🧱 Materiales / Insumos ({fields.length})</h3>
        <ChevronDown size={18} />
      </div>
      {isOpen && (
        <div className="section-body">
          {fields.length > 0 && (
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
                {fields.map((field, i) => (
                  <tr key={field.id}>
                    <td>
                      <select
                        value={field.material_id || ""}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const selectedMat = masterMaterials.find(x => x.id === selectedId);
                          if (selectedMat) {
                            update(i, { 
                              ...field, 
                              material_id: selectedMat.id, 
                              name: selectedMat.name,
                              unit: selectedMat.unit,
                              unit_cost: selectedMat.cost 
                            });
                          } else {
                            update(i, { ...field, material_id: null, name: "" });
                          }
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
                        value={field.quantity}
                        onChange={(e) => update(i, { ...field, quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <div style={{ padding: "0 8px", color: "var(--text-secondary)" }}>
                        {formatCurrency(field.unit_cost)}
                      </div>
                    </td>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {formatCurrency(field.quantity * field.unit_cost)}
                    </td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn-icon"
                        style={{ color: "var(--error)", width: 28, height: 28 }}
                        onClick={() => remove(i)}
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
            onClick={() => append({ name: "", material_id: null, quantity: 1, unit_cost: 0, unit: "unidad" })}
          >
            <Plus size={14} /> Agregar material
          </button>
        </div>
      )}
    </div>
  );
}
