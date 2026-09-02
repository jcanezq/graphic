import { useFieldArray, Control } from "react-hook-form";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ProductFormValues } from "@/lib/validations/product";
import { useState } from "react";

interface Props {
  control: Control<ProductFormValues>;
}

export function LaborSection({ control }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "labor"
  });

  return (
    <div className="section-collapsible">
      <div
        className={`section-header ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3>👷 Mano de Obra ({fields.length})</h3>
        <ChevronDown size={18} />
      </div>
      {isOpen && (
        <div className="section-body">
          {fields.length > 0 && (
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
                {fields.map((field, i) => (
                  <tr key={field.id}>
                    <td>
                      <input
                        value={field.work_type}
                        onChange={(e) => update(i, { ...field, work_type: e.target.value })}
                        placeholder="Instalación"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        value={field.hours}
                        onChange={(e) => update(i, { ...field, hours: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={field.hourly_rate}
                        onChange={(e) => update(i, { ...field, hourly_rate: Number(e.target.value) })}
                      />
                    </td>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {formatCurrency(field.hours * field.hourly_rate)}
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
            onClick={() => append({ work_type: "", hours: 1, hourly_rate: 0 })}
          >
            <Plus size={14} /> Agregar mano de obra
          </button>
        </div>
      )}
    </div>
  );
}
