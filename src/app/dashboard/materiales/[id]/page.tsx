"use client";

import CatalogFormPage from "@/components/catalog/CatalogFormPage";

export default function MaterialFormPageWrapper() {
  return (
    <CatalogFormPage
      type="Material"
      basePath="/dashboard/materiales"
      labels={{
        titleNew: "Nuevo Material",
        titleEdit: "Editar Material",
        subtitleNew: "Registra un nuevo material en el catálogo",
        successNew: "Material creado exitosamente",
        successEdit: "Material actualizado",
      }}
    />
  );
}
