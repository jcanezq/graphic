"use client";

import CatalogListPage from "@/components/catalog/CatalogListPage";

export default function ServicesPage() {
  return (
    <CatalogListPage
      type="Servicio"
      queryKey="servicios_list"
      basePath="/dashboard/servicios"
      labels={{ plural: "Servicios", singular: "servicio", nuevo: "Nuevo Servicio" }}
    />
  );
}
