import { describe, it, expect } from 'vitest';
import {
  calcMaterialCost,
  calcLaborCost,
  calcIndirectCost,
  calcUnitCost,
  calcUnitPrice,
  calcItemSubtotal,
  round2,
  calcQuotationTotals
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
        { name: 'Mat 1', quantity: 2, unit_cost: 10 },
        { name: 'Mat 2', quantity: 1.5, unit_cost: 20 },
      ];
      // 2*10 + 1.5*20 = 20 + 30 = 50
      expect(calcMaterialCost(materials)).toBe(50);
    });

    it('should calculate labor cost correctly', () => {
      const labor: ProductLabor[] = [
        { work_type: 'Design', hours: 2, hourly_rate: 15 },
        { work_type: 'Assembly', hours: 1, hourly_rate: 20 },
      ];
      // 2*15 + 1*20 = 30 + 20 = 50
      expect(calcLaborCost(labor)).toBe(50);
    });

    it('should calculate indirect cost correctly', () => {
      const indirects: ProductIndirectCost[] = [
        { concept: 'Energy', cost: 5 },
        { concept: 'Transport', cost: 15 },
      ];
      expect(calcIndirectCost(indirects)).toBe(20);
    });
  });

  describe('calcUnitCost', () => {
    it('should use manual_unit_cost if available and > 0', () => {
      const product = {
        manual_unit_cost: 100,
        materials: [{ name: 'M1', quantity: 1, unit_cost: 10 }],
        labor: [],
        indirect_costs: []
      };
      expect(calcUnitCost(product)).toBe(100);
    });

    it('should sum components if manual_unit_cost is null or 0', () => {
      const product = {
        manual_unit_cost: 0,
        materials: [{ name: 'M1', quantity: 1, unit_cost: 10 }],
        labor: [{ work_type: 'L1', hours: 2, hourly_rate: 10 }], // 20
        indirect_costs: [{ concept: 'I1', cost: 5 }]
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

});
