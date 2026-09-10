"use client";

import CatalogListPage from "@/components/catalog/CatalogListPage";

export default function MaterialsPage() {
  return (
    <CatalogListPage
      type="Material"
      queryKey="materiales_list"
      basePath="/dashboard/materiales"
      labels={{ plural: "Materiales", singular: "material", nuevo: "Nuevo Material" }}
    />
  );
}
