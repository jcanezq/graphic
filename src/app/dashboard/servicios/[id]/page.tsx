"use client";

import CatalogFormPage from "@/components/catalog/CatalogFormPage";

export default function ServiceFormPageWrapper() {
  return (
    <CatalogFormPage
      type="Servicio"
      basePath="/dashboard/servicios"
      labels={{
        titleNew: "Nuevo Servicio",
        titleEdit: "Editar Servicio",
        subtitleNew: "Registra un nuevo producto o servicio",
        successNew: "Servicio creado exitosamente",
        successEdit: "Servicio actualizado",
      }}
    />
  );
}
