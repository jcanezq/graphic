"use client";

import CatalogListPage from "@/components/catalog/CatalogListPage";

export default function ProductsPage() {
  return (
    <CatalogListPage
      type="Producto"
      queryKey="productos_list"
      basePath="/dashboard/productos"
      labels={{ plural: "Productos", singular: "producto", nuevo: "Nuevo Producto" }}
    />
  );
}
