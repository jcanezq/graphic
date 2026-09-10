import { describe, it, expect } from 'vitest';
import {
  calcUnitCost, calcUnitPrice, round2,
  createQuotationItemFromProduct, calcQuotationTotals, recalcQuotationItem,
} from '@/lib/calculations';

// Escenario canónico de la FASE 2. Estructura idéntica a la que carga
// scripts/import-services.ts: mano de obra en product_labor, "Diseño" y
// "Transporte" en product_indirect_costs.
const SERVICIO: any = {
  id: 'p1', code: 'SRV-001', name: 'Rotulo', type: 'Servicio', unit: 'm²',
  description: '', manual_unit_cost: null, default_margin: 35, is_active: true,
  category_id: null, image_url: null,
  materials: [{ name: 'Vinil', quantity: 1, unit_cost: 10, unit: 'm2', material_id: null }],
  labor: [{ work_type: 'Instalacion', hours: 1, hourly_rate: 20 }],
  indirect_costs: [{ concept: 'Diseño gráfico', cost: 15 }, { concept: 'Transporte', cost: 5 }],
};
const MARGEN = 35;
const IGV = 0.18;

/** Reproduce el cálculo de /api/public/products + /cotizar (carrito). */
function totalDelCarrito(product: any, qty: number) {
  // Simulate route.ts
  const materialCost = product.materials.reduce((acc: number, m: any) => acc + (m.quantity * m.unit_cost), 0);
  const laborCost = product.labor.reduce((acc: number, l: any) => acc + (l.hours * l.hourly_rate), 0);
  const designCost = product.indirect_costs.find((i: any) => i.concept === 'Diseño gráfico' || i.concept === 'Diseno grafico')?.cost ?? 0;
  const transportCost = product.indirect_costs.find((i: any) => i.concept === 'Transporte')?.cost ?? 0;
  
  const baseCost = materialCost;
  const margin = product.default_margin;
  
  const baseUnitPrice = round2(calcUnitPrice(baseCost, margin));
  const laborPrice = round2(calcUnitPrice(laborCost, margin));
  const designPrice = round2(calcUnitPrice(designCost, margin));
  const transportPrice = round2(calcUnitPrice(transportCost, margin));

  // Simulate lineTotal in cotizar/page.tsx
  const base = round2(qty * baseUnitPrice);
  const comp = (price: number, scope: string) => {
    if (!(price > 0)) return 0;
    return round2((scope === 'unit' ? qty : 1) * price);
  };

  const subtotal = round2(
    base
    + comp(laborPrice, 'unit')
    + comp(designPrice, 'order')
    + comp(transportPrice, 'order')
  );

  return { subtotal, total: round2(subtotal * (1 + IGV)) };
}

/** Reproduce el cálculo de /api/client/quotations (lo que se guarda en la BD). */
function totalGuardado(product: any, qty: number) {
  const item = createQuotationItemFromProduct(product, qty, MARGEN, 0);
  const t = calcQuotationTotals([item] as any, IGV);
  return { subtotal: t.subtotal, total: t.total };
}

describe('FASE 2 — una sola fuente de verdad del precio', () => {

  // ---- C-1: el defecto central ----
  it('cantidad 3: el total del carrito y el total guardado deben coincidir', () => {
    const carrito = totalDelCarrito(SERVICIO, 3);
    const guardado = totalGuardado(SERVICIO, 3);
    expect(carrito.total).toBe(guardado.total);
  });

  it('cantidad 3: el total correcto es 175.23 (labor x cant, diseño y transporte x 1)', () => {
    expect(totalGuardado(SERVICIO, 3)).toEqual({ subtotal: 148.50, total: 175.23 });
  });

  // ---- NO-REGRESIÓN: cantidad 1 hoy ya funciona y debe seguir igual ----
  it('cantidad 1: los dos caminos coinciden y dan 67.50 / 79.65 (no-regresión)', () => {
    expect(totalDelCarrito(SERVICIO, 1)).toEqual({ subtotal: 67.50, total: 79.65 });
    expect(totalGuardado(SERVICIO, 1)).toEqual({ subtotal: 67.50, total: 79.65 });
  });

  // ---- C-4: la clasificación no puede depender de la tilde ----
  it('un indirecto "Diseno grafico" sin tilde cuesta lo mismo que "Diseño gráfico"', () => {
    const conTilde = { ...SERVICIO, indirect_costs: [{ concept: 'Diseño gráfico', cost: 15 }, { concept: 'Transporte', cost: 5 }] };
    const sinTilde = { ...SERVICIO, indirect_costs: [{ concept: 'Diseno grafico', cost: 15 }, { concept: 'Transporte', cost: 5 }] };
    expect(totalGuardado(sinTilde, 3).total).toBe(totalGuardado(conTilde, 3).total);
  });

  // ---- A-3: ningún ítem puede producir NaN ----
  it('un ítem heredado sin labor_cost no produce NaN', () => {
    const legacy: any = { quantity: 2, margin_percent: 30, unit_cost: 10, product_name: 'X', unit: 'u' };
    const r = recalcQuotationItem(legacy, {});
    expect(Number.isFinite(r.subtotal)).toBe(true);
    expect(Number.isFinite(r.unit_price)).toBe(true);
  });

  // ---- A-1: un Producto con mano de obra cobra y debe poder mostrarse ----
  it('un Producto (no Servicio) con mano de obra cobra 143.37 con cantidad 3', () => {
    const producto = { ...SERVICIO, type: 'Producto', indirect_costs: [] };
    expect(totalGuardado(producto, 3)).toEqual({ subtotal: 121.50, total: 143.37 });
  });

  // ---- M-2: el redondeo declarado es "por fila, sumando redondeados" ----
  it('40 ítems: el subtotal es la suma de los subtotales redondeados', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ subtotal: 10.005 + i * 0.01 })) as any;
    expect(calcQuotationTotals(items, IGV).subtotal).toBe(408.20);
  });
});
