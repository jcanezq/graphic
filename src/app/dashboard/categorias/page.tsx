import { createClient } from "@/lib/supabase/server";
import CategoryTable from "./CategoryTable";
import type { Category } from "@/types";
import { unwrapList } from "@/lib/supabase/unwrap";
import type { CategoryWithCount } from "./CategoryModal";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const supabase = createClient();

  const [categoriesRes, productsRes] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select("id, category_id")
      .is("deleted_at", null),
  ]);

  const categories = unwrapList<Category>(categoriesRes as any, "categories.list");
  const products = unwrapList<{ id: string; category_id: string | null }>(
    productsRes as any,
    "categories.products_count"
  );

  // Contar productos por categoría
  const countMap = new Map<string, number>();
  for (const p of products) {
    if (p.category_id) {
      countMap.set(p.category_id, (countMap.get(p.category_id) || 0) + 1);
    }
  }

  const categoriesWithCount: CategoryWithCount[] = categories.map((c) => ({
    ...c,
    productCount: countMap.get(c.id) || 0,
  }));

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Categorías</h1>
          <p className="subtitle">{categories.length} categorías registradas</p>
        </div>
      </div>
      <div className="page-body">
        <CategoryTable initialCategories={categoriesWithCount} />
      </div>
    </div>
  );
}

