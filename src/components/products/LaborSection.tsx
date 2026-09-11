import { useFieldArray, Control, UseFormRegister, UseFormWatch } from "react-hook-form";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ProductFormValues } from "@/lib/validations/product";
import { useState } from "react";

interface Props {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  watch: UseFormWatch<ProductFormValues>;
}

export function LaborSection({ control, register, watch }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const { fields, append, remove } = useFieldArray({
    control,
    name: "labor"
  });
  
  const watchedLabor = watch("labor") || [];

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
                {fields.map((field, i) => {
                  const currentHours = watchedLabor[i]?.hours || 0;
                  const currentRate = watchedLabor[i]?.hourly_rate || 0;
                  return (
                  <tr key={field.id}>
                    <td>
                      <input
                        {...register(`labor.${i}.work_type` as const)}
                        placeholder="Instalación"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        {...register(`labor.${i}.hours` as const, { valueAsNumber: true })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`labor.${i}.hourly_rate` as const, { valueAsNumber: true })}
                      />
                    </td>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {formatCurrency(currentHours * currentRate)}
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
            onClick={() => append({ work_type: "", hours: 1, hourly_rate: 0 })}
          >
            <Plus size={14} /> Agregar mano de obra
          </button>
        </div>
      )}
    </div>
  );
}
