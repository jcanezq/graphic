import { UseFormWatch, Control } from "react-hook-form";
import { Save } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ProductFormValues } from "@/lib/validations/product";
import { calcMaterialCost, calcLaborCost, calcIndirectCost, calcUnitPrice } from "@/lib/calculations";

interface Props {
  watch: UseFormWatch<ProductFormValues>;
  saving: boolean;
  isNew: boolean;
}

export function CostSummarySection({ watch, saving, isNew }: Props) {
  const materials = watch("materials") || [];
  const labor = watch("labor") || [];
  const indirects = watch("indirects") || [];
  const defaultMargin = watch("default_margin") || 0;
  const useManualCost = watch("useManualCost");
  const manualCost = watch("manual_unit_cost");

  // Cast arrays to match calculation types
  const materialTotal = calcMaterialCost(materials.map(m => ({ ...m, product_id: "" })));
  const laborTotal = calcLaborCost(labor.map(l => ({ ...l, product_id: "", id: "" })));
  const indirectTotal = calcIndirectCost(indirects.map(i => ({ ...i, product_id: "", id: "" })));
  
  const unitCost = useManualCost && manualCost ? manualCost : materialTotal + laborTotal + indirectTotal;
  const salePrice = calcUnitPrice(unitCost, defaultMargin);

  return (
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
      >
        <Save size={16} />
        {saving ? "Guardando..." : isNew ? "Crear Producto" : "Guardar Cambios"}
      </button>
    </div>
  );
}
