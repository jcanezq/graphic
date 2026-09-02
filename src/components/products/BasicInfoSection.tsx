import { UseFormRegister, Control, useWatch } from "react-hook-form";
import type { ProductFormValues } from "@/lib/validations/product";
import type { Category } from "@/types";

interface Props {
  register: UseFormRegister<ProductFormValues>;
  control: Control<ProductFormValues>;
  categories: Category[];
  errors: any;
}

const UNITS = [
  { value: "m²", label: "Metro cuadrado (m²)" },
  { value: "unidad", label: "Unidad" },
  { value: "kit", label: "Kit" },
  { value: "servicio", label: "Servicio" },
  { value: "ml", label: "Metro lineal (ml)" },
  { value: "metro", label: "Metro" },
];

export function BasicInfoSection({ register, control, categories, errors }: Props) {
  const useManualCost = useWatch({ control, name: "useManualCost" });

  return (
    <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
      <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
        Información Básica
      </h3>
      <div className="form-row">
        <div className="form-group">
          <label>Código *</label>
          <input
            {...register("code", { onChange: (e) => e.target.value = e.target.value.toUpperCase() })}
            placeholder="EXH-001"
            className={errors.code ? "error" : ""}
          />
          {errors.code && <span className="error-text">{errors.code.message}</span>}
        </div>
        <div className="form-group">
          <label>Unidad de medida</label>
          <select {...register("unit")}>
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Nombre del producto/servicio *</label>
        <input
          {...register("name")}
          placeholder="Exhibidor en acrílico"
          className={errors.name ? "error" : ""}
        />
        {errors.name && <span className="error-text">{errors.name.message}</span>}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Tipo *</label>
          <select {...register("type")}>
            <option value="Producto">Producto</option>
            <option value="Servicio">Servicio</option>
          </select>
        </div>
        <div className="form-group">
          <label>Categoría</label>
          <select {...register("category_id")}>
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
            {...register("default_margin", { valueAsNumber: true })}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Descripción</label>
        <textarea
          {...register("description")}
          placeholder="Descripción detallada del producto o servicio..."
          rows={3}
        />
      </div>
      <div style={{ display: "flex", gap: "var(--space-xl)", alignItems: "center" }}>
        <label className="toggle" style={{ marginBottom: 0 }}>
          <input type="checkbox" {...register("is_active")} />
          <span className="toggle-track" />
          Producto activo
        </label>
        <label className="toggle" style={{ marginBottom: 0 }}>
          <input type="checkbox" {...register("useManualCost")} />
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
            {...register("manual_unit_cost", { valueAsNumber: true })}
            placeholder="0.00"
          />
        </div>
      )}
    </div>
  );
}
