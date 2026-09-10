"use client";

import CatalogFormPage from "@/components/catalog/CatalogFormPage";

export default function ProductFormPageWrapper() {
  return (
    <CatalogFormPage
      type="Producto"
      basePath="/dashboard/productos"
      labels={{
        titleNew: "Nuevo Producto",
        titleEdit: "Editar Producto",
        subtitleNew: "Registra un nuevo producto o servicio",
        successNew: "Producto creado exitosamente",
        successEdit: "Producto actualizado",
      }}
    />
  );
}
