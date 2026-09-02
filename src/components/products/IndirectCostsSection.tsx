import { useFieldArray, Control } from "react-hook-form";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ProductFormValues } from "@/lib/validations/product";
import { useState } from "react";

interface Props {
  control: Control<ProductFormValues>;
}

export function IndirectCostsSection({ control }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "indirects"
  });

  return (
    <div className="section-collapsible">
      <div
        className={`section-header ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3>📦 Costos Indirectos ({fields.length})</h3>
        <ChevronDown size={18} />
      </div>
      {isOpen && (
        <div className="section-body">
          {fields.length > 0 && (
            <table className="cost-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th style={{ width: 140 }}>Costo (S/)</th>
                  <th className="row-actions" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => (
                  <tr key={field.id}>
                    <td>
                      <input
                        value={field.concept}
                        onChange={(e) => update(i, { ...field, concept: e.target.value })}
                        placeholder="Transporte"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={field.cost}
                        onChange={(e) => update(i, { ...field, cost: Number(e.target.value) })}
                      />
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
            onClick={() => append({ concept: "", cost: 0 })}
          >
            <Plus size={14} /> Agregar costo indirecto
          </button>
        </div>
      )}
    </div>
  );
}
