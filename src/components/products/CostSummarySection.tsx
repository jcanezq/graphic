import { UseFormWatch, Control } from "react-hook-form";
import { Save } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ProductFormValues } from "@/lib/validations/product";
import { calcMaterialCost, calcLaborCost, calcIndirectCost, buildCatalogPricing } from "@/lib/calculations";

interface Props {
  watch: UseFormWatch<ProductFormValues>;
  saving: boolean;
  isNew: boolean;
}

export function CostSummarySection({ watch, saving, isNew }: Props) {
  const materials = watch("materials") || [];
  const labor = watch("labor") || [];
  const production_costs = watch("production_costs") || [];
  const other_costs = watch("other_costs") || [];
  const defaultMargin = watch("default_margin") || 0;
  const useManualCost = watch("useManualCost");
  const manualCost = watch("manual_unit_cost");

  // Cast arrays to match calculation types
  const materialTotal = calcMaterialCost(materials.map(m => ({ ...m, product_id: "", material_id: m.material_id || null })));
  const laborTotal = calcLaborCost(labor.map(l => ({ ...l, product_id: "", id: "" })));
  const productionTotal = calcIndirectCost(production_costs.map(i => ({ ...i, cost: (i.quantity || 0) * (i.unit_cost || 0), product_id: "", id: "", kind: "production" as any })));
  const otherTotal = calcIndirectCost(other_costs.map(i => ({ ...i, cost: (i.quantity || 0) * (i.unit_cost || 0), product_id: "", id: "", kind: "other" as any })));
  const indirectTotal = productionTotal + otherTotal;
  
  // Una sola fuente de verdad: EXACTAMENTE la misma función que usan el catálogo,
  // la ruta pública y las pruebas. Antes este panel tenía su propia aritmética y
  // difería del catálogo siempre que había costo manual: el motor ignora los
  // materiales pero SUMA la mano de obra, el diseño y el transporte, y este panel
  // no sumaba ninguno de los tres.
  const pricing = buildCatalogPricing(
    {
      manual_unit_cost: useManualCost ? manualCost : null,
      default_margin: defaultMargin,
    },
    materials.map((m) => ({ quantity: m.quantity || 0, unit_cost: m.unit_cost || 0 })),
    labor.map((l) => ({ hours: l.hours || 0, hourly_rate: l.hourly_rate || 0 })),
    [
      ...production_costs.map((i) => ({ concept: i.concept, kind: 'production', quantity: i.quantity, unit_cost: i.unit_cost })),
      ...other_costs.map((i) => ({ concept: i.concept, kind: 'other', quantity: i.quantity, unit_cost: i.unit_cost })),
    ],
  );

  const unitCost = pricing.baseCost + pricing.laborCost + pricing.designCost + pricing.transportCost;
  const salePrice = pricing.unitPrice;

  return (
    <div className="cost-breakdown" style={{ position: "sticky", top: 90 }}>
      <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
        Resumen de Costos
      </h3>
      {watch("type") !== "Material" && (
        <>
          <div className="cost-breakdown-row">
            <span>Materiales</span>
            <span>{formatCurrency(materialTotal)}</span>
          </div>
          <div className="cost-breakdown-row">
            <span>Mano de obra</span>
            <span>{formatCurrency(laborTotal)}</span>
          </div>
          <div className="cost-breakdown-row">
            <span>Producción</span>
            <span>{formatCurrency(productionTotal)}</span>
          </div>
          <div className="cost-breakdown-row">
            <span>Otros</span>
            <span>{formatCurrency(otherTotal)}</span>
          </div>
        </>
      )}
      {useManualCost && (pricing.materialCost > 0 || pricing.otherIndirectCost > 0) && (
        <div style={{ margin: "var(--space-sm) 0", padding: "0.5rem 0.65rem", borderRadius: "var(--radius-sm)", background: "var(--bg-glass)", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
          Con <strong>costo manual</strong> activado, los materiales y los costos de
          «Otros» <strong>no se suman</strong>: el costo manual los reemplaza. La mano de
          obra, el diseño y el transporte <strong>sí</strong> se suman por encima.
          Desactivá el costo manual si querés que el precio salga del desglose.
        </div>
      )}
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
