import { describe, it, expect } from 'vitest';
import {
  calcMaterialCost,
  calcLaborCost,
  calcIndirectCost,
  calcUnitCost,
  calcUnitPrice,
  calcItemSubtotal,
  round2,
  calcQuotationTotals,
  createQuotationItemFromProduct,
  buildCatalogPricing
} from '@/lib/calculations';
import type { ProductMaterial, ProductLabor, ProductIndirectCost, QuotationItem } from '@/types';

describe('Calculations Library', () => {
  
  describe('round2', () => {
    it('should round numbers to 2 decimal places correctly', () => {
      expect(round2(10.123)).toBe(10.12);
      expect(round2(10.125)).toBe(10.13);
      expect(round2(10.129)).toBe(10.13);
      expect(round2(10)).toBe(10);
    });
  });

  describe('Costs Calculation', () => {
    it('should calculate material cost correctly', () => {
      const materials: ProductMaterial[] = [
        { name: 'Mat 1', quantity: 2, unit_cost: 10, unit: 'un', material_id: null },
        { name: 'Mat 2', quantity: 1.5, unit_cost: 20, unit: 'kg', material_id: null },
      ];
      // 2*10 + 1.5*20 = 20 + 30 = 50
      expect(calcMaterialCost(materials)).toBe(50);
    });

    it('should calculate labor cost correctly', () => {
      const labor: ProductLabor[] = [
        { work_type: 'Design', unit: 'hora', hours: 2, hourly_rate: 15 } as ProductLabor,
        { work_type: 'Assembly', unit: 'hora', hours: 1, hourly_rate: 20 } as ProductLabor,
      ];
      // 2*15 + 1*20 = 30 + 20 = 50
      expect(calcLaborCost(labor)).toBe(50);
    });

    it('should calculate indirect cost correctly', () => {
      const indirects: ProductIndirectCost[] = [
        { concept: 'Energy', cost: 5, unit: 'global', quantity: 1, unit_cost: 5, kind: 'other' } as ProductIndirectCost,
        { concept: 'Transport', cost: 15, unit: 'global', quantity: 1, unit_cost: 15, kind: 'transport' } as ProductIndirectCost,
      ];
      expect(calcIndirectCost(indirects)).toBe(20);
    });
  });



  describe('calcUnitCost', () => {
    it('should use manual_unit_cost if available and > 0', () => {
      const product = {
        manual_unit_cost: 100,
        materials: [{ name: 'M1', quantity: 1, unit_cost: 10, unit: 'un', material_id: null }] as any[],
        labor: [],
        indirect_costs: []
      };
      expect(calcUnitCost(product)).toBe(100);
    });

    it('should sum components if manual_unit_cost is null or 0', () => {
      const product = {
        manual_unit_cost: 0,
        materials: [{ name: 'M1', quantity: 1, unit_cost: 10, unit: 'un', material_id: null }] as any[],
        labor: [{ work_type: 'L1', unit: 'hora', hours: 2, hourly_rate: 10 }] as ProductLabor[],
        indirect_costs: [{ concept: 'I1', cost: 5, unit: 'global', quantity: 1, unit_cost: 5, kind: 'other' as const }] as ProductIndirectCost[],
      };
      expect(calcUnitCost(product)).toBe(35); // 10 + 20 + 5
    });
  });

  describe('calcUnitPrice and calcItemSubtotal', () => {
    it('should calculate unit price with margin', () => {
      expect(calcUnitPrice(100, 30)).toBe(130); // 100 * 1.3
      expect(calcUnitPrice(50, 50)).toBe(75); // 50 * 1.5
    });

    it('should calculate subtotal correctly', () => {
      expect(calcItemSubtotal(2, 130)).toBe(260);
      expect(calcItemSubtotal(1.5, 100)).toBe(150);
    });
  });

  describe('calcQuotationTotals', () => {
    it('should calculate overall quotation totals with IGV', () => {
      const items: QuotationItem[] = [
        { subtotal: 100 } as QuotationItem,
        { subtotal: 200 } as QuotationItem,
      ];
      const result = calcQuotationTotals(items, 0.18);
      
      expect(result.subtotal).toBe(300);
      expect(result.igv).toBe(54); // 300 * 0.18
      expect(result.total).toBe(354);
    });
  });

  describe('contrato de unit_price tras la FASE 2', () => {
    it('unit_price es el precio de la fila base, no el promedio ponderado', () => {
      const item = createQuotationItemFromProduct({
        id: 'p', code: 'C', name: 'N', type: 'Servicio', unit: 'm²', description: '',
        manual_unit_cost: null, default_margin: 35,
        materials: [{ name: 'M', quantity: 1, unit_cost: 10, unit: 'm2', material_id: null }],
        labor: [{ work_type: 'L', hours: 1, hourly_rate: 20 }],
        indirect_costs: [],
      } as any, 3, 35, 0);
      expect(item.unit_price).toBe(13.50);   // base: 10 * 1.35
      expect(item.subtotal).toBe(121.50);    // 40.50 base + 81.00 labor (scope 'unit')
    });
  });

  describe('MAT-T4: golden quotation matches across catalog and save paths', () => {
    it('asserts the golden quotation matches across catalog and save paths', () => {
      const product = {
        id: 'SRV-2026-0508', code: 'SRV-2026-0508', name: 'Golden Product', type: 'Servicio', unit: 'm²', description: '',
        manual_unit_cost: null, default_margin: 35,
        materials: [
          { name: 'Vinil laminado premium',            quantity: 1, unit_cost: 30, unit: 'm²', material_id: null },
          { name: 'Laminado de protección de pintura', quantity: 1, unit_cost: 10, unit: 'm²', material_id: null },
        ],
        labor: [{ work_type: 'Labor', hours: 1, hourly_rate: 60 }],
        indirect_costs: [
          // «Grafico» SIN TILDE y kind 'production', tal cual está cargado en producción.
          // Este es el caso que el clasificador tiene que reconocer: si vuelve a caer en el
          // costo base, el desglose de abajo se rompe.
          { concept: 'Diseño Grafico',    kind: 'production', unit: 'global', quantity: 1, unit_cost: 18, cost: 18 },
          { concept: 'impresión digital', kind: 'production', unit: 'm2',     quantity: 1, unit_cost: 15, cost: 15 },
          { concept: 'Plotter de corte',  kind: 'production', unit: 'm2',     quantity: 1, unit_cost: 7,  cost: 7  },
          { concept: 'Transporte',        kind: 'other',      unit: 'global', quantity: 1, unit_cost: 20, cost: 20 },
        ],
      };

      // 1. Catálogo público
      const pricing = buildCatalogPricing(product, product.materials, product.labor, product.indirect_costs);

      // El desglose, pieza por pieza
      expect(pricing.materialCost).toBe(40);
      expect(pricing.laborCost).toBe(60);
      expect(pricing.designCost).toBe(18);
      expect(pricing.transportCost).toBe(20);
      expect(pricing.otherIndirectCost).toBe(22); // 60 - 18 - 20 = 22
      expect(pricing.baseCost).toBe(62);

      // Los precios de cada línea
      expect(pricing.baseUnitPrice).toBe(83.70);
      expect(pricing.laborPrice).toBe(81.00);
      expect(pricing.designPrice).toBe(24.30);
      expect(pricing.transportPrice).toBe(27.00);

      // Y recién entonces el total
      expect(pricing.unitPrice).toBe(216.00);

      // 2. Guardado del portal (createQuotationItemFromProduct)
      const item = createQuotationItemFromProduct(product as any, 1, product.default_margin, 0);
      
      expect(item.subtotal).toBe(pricing.unitPrice);

      // 3. Totales
      const totals = calcQuotationTotals([item], 0.18);
      expect(totals.subtotal).toBe(216.00);
      expect(totals.igv).toBe(38.88);
      expect(totals.total).toBe(254.88);
    });

    it('cantidad 3 — fija los escalados (unit vs order)', () => {
      const product = {
        id: 'SRV-2026-0508', code: 'SRV-2026-0508', name: 'Golden Product', type: 'Servicio', unit: 'm²', description: '',
        manual_unit_cost: null, default_margin: 35,
        materials: [
          { name: 'Vinil laminado premium',            quantity: 1, unit_cost: 30, unit: 'm²', material_id: null },
          { name: 'Laminado de protección de pintura', quantity: 1, unit_cost: 10, unit: 'm²', material_id: null },
        ],
        labor: [{ work_type: 'Labor', hours: 1, hourly_rate: 60 }],
        indirect_costs: [
          { concept: 'Diseño Grafico',    kind: 'production', unit: 'global', quantity: 1, unit_cost: 18, cost: 18 },
          { concept: 'impresión digital', kind: 'production', unit: 'm2',     quantity: 1, unit_cost: 15, cost: 15 },
          { concept: 'Plotter de corte',  kind: 'production', unit: 'm2',     quantity: 1, unit_cost: 7,  cost: 7  },
          { concept: 'Transporte',        kind: 'other',      unit: 'global', quantity: 1, unit_cost: 20, cost: 20 },
        ],
      };

      const item3 = createQuotationItemFromProduct(product as any, 3, product.default_margin, 0);
      // base 83.70 × 3 = 251.10 · labor 81.00 × 3 = 243.00 · diseño 24.30 × 1 · transporte 27.00 × 1
      expect(item3.subtotal).toBe(545.40);
      
      const totals3 = calcQuotationTotals([item3], 0.18);
      expect(totals3.total).toBe(643.57);
    });

    it('una fila con unit_cost 0 y cost 18 no produce costo base negativo', () => {
      const product = {
        id: 'SRV-2026-0508', code: 'SRV-2026-0508', name: 'Golden Product', type: 'Servicio', unit: 'm²', description: '',
        manual_unit_cost: null, default_margin: 35,
        materials: [
          { name: 'Vinil laminado premium',            quantity: 1, unit_cost: 30, unit: 'm²', material_id: null },
          { name: 'Laminado de protección de pintura', quantity: 1, unit_cost: 10, unit: 'm²', material_id: null },
        ],
        labor: [{ work_type: 'Labor', hours: 1, hourly_rate: 60 }],
        indirect_costs: [
          { concept: 'Diseño Grafico',    kind: 'production', unit: 'global', quantity: 1, unit_cost: 18, cost: 18 },
          { concept: 'impresión digital', kind: 'production', unit: 'm2',     quantity: 1, unit_cost: 15, cost: 15 },
          { concept: 'Plotter de corte',  kind: 'production', unit: 'm2',     quantity: 1, unit_cost: 7,  cost: 7  },
          { concept: 'Transporte',        kind: 'other',      unit: 'global', quantity: 1, unit_cost: 20, cost: 20 },
        ],
      };
      
      const roto = { ...product, indirect_costs: product.indirect_costs.map(
        (ic: any) => ({ ...ic, unit_cost: 0 })) };
      const item = createQuotationItemFromProduct(roto as any, 1, 35, 0);
      expect(item.unit_cost).toBeGreaterThanOrEqual(0);
    });
  });
});
