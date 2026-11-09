import type { Category, Unit } from "@/types";

/**
 * Genera un slug normalizado y URL-friendly a partir del nombre de una categoría.
 * Convierte a minúsculas, remueve acentos/diacríticos, reemplaza espacios y caracteres
 * especiales por guiones, y colapsa guiones repetidos.
 */
export function slugifyCategory(name: string): string {
  if (!name) return "";
  return name
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve tildes y diacríticos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // Caracteres no alfanuméricos -> guión
    .replace(/^-+|-+$/g, ""); // Quita guiones iniciales y finales
}

export type CategoryWithDisplay = Category & {
  displayLabel: string;
};

export type UnitWithDisplay = Unit & {
  displayLabel: string;
};

/**
 * Regla de negocio para selectores de categorías (ARQUITECTURA §7 / Mantenedores):
 * Muestra solo las categorías activas, más la que ya tenga asignada el producto
 * aunque esté inactiva, marcada con "(inactiva)".
 */
export function filterSelectableCategories(
  categories: Category[],
  currentCategoryId?: string | null
): CategoryWithDisplay[] {
  const result: CategoryWithDisplay[] = [];

  for (const cat of categories) {
    const isSelected = Boolean(currentCategoryId && cat.id === currentCategoryId);
    if (cat.is_active || isSelected) {
      result.push({
        ...cat,
        displayLabel: cat.is_active ? cat.name : `${cat.name} (inactiva)`,
      });
    }
  }

  return result;
}

/**
 * Regla de negocio para selectores de unidades de medida (ARQUITECTURA §7 / Mantenedores):
 * Muestra solo las unidades activas, más la que ya tenga asignada el producto
 * aunque esté inactiva, marcada con "(inactiva)".
 * Si el producto tiene un código no existente en el catálogo de unidades, se incluye
 * también con la marca "(inactiva)" para no perder el dato en el selector.
 */
export function filterSelectableUnits(
  units: Unit[],
  currentUnitCode?: string | null
): UnitWithDisplay[] {
  const result: UnitWithDisplay[] = [];
  let currentFound = false;

  for (const u of units) {
    const isSelected = Boolean(currentUnitCode && u.code === currentUnitCode);
    if (isSelected) {
      currentFound = true;
    }
    if (u.is_active || isSelected) {
      result.push({
        ...u,
        displayLabel: u.is_active ? u.label : `${u.label} (inactiva)`,
      });
    }
  }

  // Si el producto tiene un unit que no está en la tabla (ej. legacy huérfano),
  // se preserva en el selector con la marca "(inactiva)"
  if (currentUnitCode && !currentFound) {
    result.push({
      id: "legacy-unknown",
      code: currentUnitCode,
      label: currentUnitCode,
      sort_order: 9999,
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      displayLabel: `${currentUnitCode} (inactiva)`,
    });
  }

  return result;
}

