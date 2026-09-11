import { useFieldArray, Control, UseFormRegister, UseFormWatch } from "react-hook-form";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ProductFormValues } from "@/lib/validations/product";
import { useState } from "react";

interface Props {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  watch: UseFormWatch<ProductFormValues>;
  name: "production_costs" | "other_costs";
  title: string;
  buttonText: string;
}

export function IndirectCostsSection({ control, register, watch, name, title, buttonText }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const { fields, append, remove } = useFieldArray({
    control,
    name
  });

  return (
    <div className="section-collapsible">
      <div
        className={`section-header ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3>{title} ({fields.length})</h3>
        <ChevronDown size={18} />
      </div>
      {isOpen && (
        <div className="section-body">
          {fields.length > 0 && (
            <table className="cost-table">
              <thead>
                <tr>
                  <th style={{ width: "35%", textAlign: "left" }}>CONCEPTO</th>
                  <th style={{ width: "15%", textAlign: "left" }}>UNIDAD</th>
                  <th style={{ width: "15%", textAlign: "left" }}>CANTIDAD</th>
                  <th style={{ width: "15%", textAlign: "right" }}>COSTO UNIT. (S/)</th>
                  <th style={{ width: "15%", textAlign: "right" }}>SUBTOTAL</th>
                  <th style={{ width: "5%" }}></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => {
                  const watchedValues = watch(name as "production_costs" | "other_costs") || [];
                  const qty = watchedValues[i]?.quantity || 0;
                  const uCost = watchedValues[i]?.unit_cost || 0;
                  return (
                  <tr key={field.id}>
                    <td>
                      <input
                        {...register(`${name}.${i}.concept` as const)}
                        defaultValue={field.concept}
                        placeholder="Transporte"
                      />
                    </td>
                    <td>
                      <select
                        {...register(`${name}.${i}.unit` as const)}
                        defaultValue={field.unit || "global"}
                      >
                        <option value="global">global</option>
                        <option value="hora">hora</option>
                        <option value="unidad">unidad</option>
                        <option value="m2">m2</option>
                        <option value="metro">metro</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`${name}.${i}.quantity` as const, { valueAsNumber: true })}
                        defaultValue={field.quantity || 1}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`${name}.${i}.unit_cost` as const, { valueAsNumber: true })}
                        defaultValue={field.unit_cost || 0}
                      />
                    </td>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500, textAlign: "right", paddingRight: 10 }}>
                      {formatCurrency(qty * uCost)}
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
            onClick={() => append({ concept: "", unit: "global", quantity: 1, unit_cost: 0 })}
          >
            <Plus size={14} /> {buttonText}
          </button>
        </div>
      )}
    </div>
  );
}
