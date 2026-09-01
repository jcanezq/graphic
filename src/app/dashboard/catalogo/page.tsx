import { createClient } from "@/lib/supabase/server";
import CatalogGallery from "./CatalogGallery";
import type { Category } from "@/types";

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const supabase = createClient();

  // Fetch categories
  const { data: cats } = await supabase.from("categories").select("*").order("sort_order");
  const categories = (cats as Category[]) || [];

  // Fetch images
  let images: any[] = [];
  const { data: files } = await supabase.storage.from("product-images").list("gallery", {
    limit: 200,
    sortBy: { column: "name", order: "asc" },
  });

  if (files) {
    images = files
      .filter((f) => f.name.match(/\.(jpg|jpeg|png|webp)$/i))
      .map((f) => {
        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(`gallery/${f.name}`);
        const parts = f.name.split("_");
        const category = parts.length > 1 ? parts[0] : "general";
        return {
          name: f.name.replace(/\.[^.]+$/, "").replace(/_/g, " "),
          url: urlData.publicUrl,
          category: category.toLowerCase(),
        };
      });
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Catálogo Visual</h1>
          <p className="subtitle">Galería de productos y servicios realizados</p>
        </div>
      </div>
      <div className="page-body">
        <CatalogGallery categories={categories} images={images} />
      </div>
    </div>
  );
}
