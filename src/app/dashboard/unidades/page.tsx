import { createClient } from "@/lib/supabase/server";
import UnitTable from "./UnitTable";
import type { Unit } from "@/types";
import { unwrapList } from "@/lib/supabase/unwrap";
import type { UnitWithCount } from "./UnitModal";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const supabase = createClient();

  const [unitsRes, productsRes] = await Promise.all([
    supabase
      .from("units")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("id, unit")
      .is("deleted_at", null),
  ]);

  const units = unwrapList<Unit>(unitsRes as any, "units.list");
  const products = unwrapList<{ id: string; unit: string }>(
    productsRes as any,
    "units.products_count"
  );

  // Contar productos por unidad
  const countMap = new Map<string, number>();
  for (const p of products) {
    if (p.unit) {
      countMap.set(p.unit, (countMap.get(p.unit) || 0) + 1);
    }
  }

  const unitsWithCount: UnitWithCount[] = units.map((u) => ({
    ...u,
    productCount: countMap.get(u.code) || 0,
  }));

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Unidades de Medida</h1>
          <p className="subtitle">{units.length} unidades registradas</p>
        </div>
      </div>
      <div className="page-body">
        <UnitTable initialUnits={unitsWithCount} />
      </div>
    </div>
  );
}
