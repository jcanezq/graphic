import { describe, it, expect } from "vitest";
import {
  cleanPhoneNumber,
  generateClientToAdminWhatsAppUrl,
  generateAdminToClientWhatsAppUrl,
} from "@/lib/whatsapp";

describe("WhatsApp Utilities", () => {
  describe("cleanPhoneNumber", () => {
    it("should prepend 51 for 9-digit Peruvian phone numbers", () => {
      expect(cleanPhoneNumber("987654321")).toBe("51987654321");
      expect(cleanPhoneNumber(" 987 654 321 ")).toBe("51987654321");
      expect(cleanPhoneNumber("+51 987654321")).toBe("51987654321");
    });

    it("should handle empty or null values gracefully", () => {
      expect(cleanPhoneNumber(null)).toBe("");
      expect(cleanPhoneNumber("")).toBe("");
      expect(cleanPhoneNumber("   ")).toBe("");
    });
  });

  describe("generateClientToAdminWhatsAppUrl", () => {
    it("should generate a valid wa.me link with quotation details and items", () => {
      const url = generateClientToAdminWhatsAppUrl({
        adminPhone: "987654321",
        quotationNumber: "COT-2026-0001",
        clientName: "Empresa Grafica",
        total: 250.5,
        items: [{ name: "Banner 13oz", quantity: 2, unit: "m²" }],
      });

      expect(url).toContain("https://wa.me/51987654321?text=");
      expect(decodeURIComponent(url)).toContain("COT-2026-0001");
      expect(decodeURIComponent(url)).toContain("Empresa Grafica");
      expect(decodeURIComponent(url)).toContain("250.50");
      expect(decodeURIComponent(url)).toContain("Banner 13oz");
      expect(decodeURIComponent(url)).toContain("confirmación técnica");
    });
  });

  describe("generateAdminToClientWhatsAppUrl", () => {
    it("should generate admin-to-client confirmation link", () => {
      const url = generateAdminToClientWhatsAppUrl({
        clientPhone: "912345678",
        quotationNumber: "COT-2026-0002",
        clientName: "Juan Pérez",
        total: 500,
      });

      expect(url).toContain("https://wa.me/51912345678?text=");
      expect(decodeURIComponent(url)).toContain("COT-2026-0002");
      expect(decodeURIComponent(url)).toContain("Juan Pérez");
      expect(decodeURIComponent(url)).toContain("500.00");
    });
  });
});
