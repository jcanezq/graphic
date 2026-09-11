import { useFieldArray, Control, UseFormRegister, UseFormWatch } from "react-hook-form";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { Material } from "@/types";
import type { ProductFormValues } from "@/lib/validations/product";
import { useState } from "react";

interface Props {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  watch: UseFormWatch<ProductFormValues>;
  masterMaterials: Material[];
}

export function MaterialsSection({ control, register, watch, masterMaterials }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "materials"
  });
  
  const watchedMaterials = watch("materials") || [];

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
                  <th style={{ width: "35%", textAlign: "left" }}>MATERIAL</th>
                  <th style={{ width: "15%", textAlign: "left" }}>UNIDAD</th>
                  <th style={{ width: "15%", textAlign: "left" }}>CANTIDAD</th>
                  <th style={{ width: "15%", textAlign: "right" }}>COSTO UNIT. (S/)</th>
                  <th style={{ width: "15%", textAlign: "right" }}>SUBTOTAL</th>
                  <th style={{ width: "5%" }}></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => {
                  const qty = watchedMaterials[i]?.quantity || 0;
                  const cost = watchedMaterials[i]?.unit_cost || 0;
                  return (
                  <tr key={field.id}>
                    <td>
                      <select
                        defaultValue={field.material_id || ""}
                        {...(() => {
                          const { onChange: rhfOnChange, ...rest } = register(`materials.${i}.material_id` as const);
                          return {
                            ...rest,
                            onChange: (e: any) => {
                              rhfOnChange(e);
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
                            }
                          };
                        })()}
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
                        {...register(`materials.${i}.unit` as const)}
                        defaultValue={field.unit || ""}
                        readOnly
                        style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                        placeholder="ej. m2"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`materials.${i}.quantity` as const, { valueAsNumber: true })}
                        defaultValue={field.quantity}
                      />
                    </td>
                    <td>
                      <div style={{ padding: "0 8px", color: "var(--text-secondary)" }}>
                        {formatCurrency(cost)}
                      </div>
                    </td>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {formatCurrency(qty * cost)}
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
                )})}
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
