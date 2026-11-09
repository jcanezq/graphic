import { describe, it, expect } from "vitest";
import {
  slugifyCategory,
  filterSelectableCategories,
  filterSelectableUnits,
} from "../maintainers";
import type { Category, Unit } from "@/types";

describe("Mantenedores: slugifyCategory", () => {
  it("convierte texto con tildes y caracteres especiales a slug limpio", () => {
    expect(slugifyCategory("Gigantografías e Impresión Digital!")).toBe(
      "gigantografias-e-impresion-digital"
    );
    expect(slugifyCategory("Señalética & Viniles 3M")).toBe("senaletica-viniles-3m");
    expect(slugifyCategory("Cajas de Luz / Backlight")).toBe("cajas-de-luz-backlight");
  });

  it("elimina guiones repetidos y en los extremos", () => {
    expect(slugifyCategory("---Rotulación---Vehicular---")).toBe("rotulacion-vehicular");
    expect(slugifyCategory("   Banderolas   ")).toBe("banderolas");
  });

  it("devuelve string vacío si recibe texto vacío o nulo", () => {
    expect(slugifyCategory("")).toBe("");
    expect(slugifyCategory("   ")).toBe("");
  });
});

describe("Mantenedores: filterSelectableCategories", () => {
  const categories: Category[] = [
    {
      id: "cat-1",
      name: "Gigantografías",
      slug: "gigantografias",
      color: "#ff0000",
      icon: "tag",
      sort_order: 1,
      is_active: true,
      deleted_at: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cat-2",
      name: "Merchandising Antiguo",
      slug: "merchandising-antiguo",
      color: "#00ff00",
      icon: "gift",
      sort_order: 2,
      is_active: false,
      deleted_at: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cat-3",
      name: "Señalética",
      slug: "senaletica",
      color: "#0000ff",
      icon: "signpost",
      sort_order: 3,
      is_active: true,
      deleted_at: null,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];

  it("excluye categorías inactivas cuando no están asignadas al producto", () => {
    const selectable = filterSelectableCategories(categories, null);
    expect(selectable.map((c) => c.id)).toEqual(["cat-1", "cat-3"]);
    expect(selectable.map((c) => c.displayLabel)).toEqual([
      "Gigantografías",
      "Señalética",
    ]);
  });

  it("incluye la categoría inactiva si coincide con la asignada al producto con etiqueta (inactiva)", () => {
    const selectable = filterSelectableCategories(categories, "cat-2");
    expect(selectable.map((c) => c.id)).toEqual(["cat-1", "cat-2", "cat-3"]);
    const inactive = selectable.find((c) => c.id === "cat-2");
    expect(inactive?.displayLabel).toBe("Merchandising Antiguo (inactiva)");
  });
});

describe("Mantenedores: filterSelectableUnits", () => {
  const units: Unit[] = [
    {
      id: "u-1",
      code: "m²",
      label: "Metro cuadrado (m²)",
      sort_order: 1,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "u-2",
      code: "rollo-descontinuado",
      label: "Rollo 50m",
      sort_order: 2,
      is_active: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "u-3",
      code: "unidad",
      label: "Unidad",
      sort_order: 3,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  it("excluye unidades inactivas para un producto nuevo o que usa unidad activa", () => {
    const selectable = filterSelectableUnits(units, "unidad");
    expect(selectable.map((u) => u.code)).toEqual(["m²", "unidad"]);
    expect(selectable.map((u) => u.displayLabel)).toEqual([
      "Metro cuadrado (m²)",
      "Unidad",
    ]);
  });

  it("incluye unidad inactiva si es la que ya tiene el producto con la marca (inactiva)", () => {
    const selectable = filterSelectableUnits(units, "rollo-descontinuado");
    expect(selectable.map((u) => u.code)).toEqual([
      "m²",
      "rollo-descontinuado",
      "unidad",
    ]);
    const inactive = selectable.find((u) => u.code === "rollo-descontinuado");
    expect(inactive?.displayLabel).toBe("Rollo 50m (inactiva)");
  });

  it("preserva unidad huérfana no encontrada en catálogo agregando (inactiva)", () => {
    const selectable = filterSelectableUnits(units, "ciento");
    expect(selectable.map((u) => u.code)).toContain("ciento");
    const custom = selectable.find((u) => u.code === "ciento");
    expect(custom?.displayLabel).toBe("ciento (inactiva)");
  });
});
