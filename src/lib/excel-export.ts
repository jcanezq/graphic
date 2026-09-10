// ============================================================
// CotiGrafix — Excel Export (exceljs)
// ============================================================

import ExcelJS from "exceljs";
import type { Quotation, CompanySettings } from "@/types";
import { formatDate } from "@/lib/formatters";
import { buildQuotationItemLines } from "@/lib/calculations";

export async function generateExcel(quotation: Quotation, settings: CompanySettings) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Cotización");
  const items = quotation.items || [];

  // Helper to add rows
  const addRow = (values: any[]) => {
    ws.addRow(values);
  };

  // Header rows
  addRow([settings.company_name || "Mi Empresa"]);
  if (settings.ruc) addRow([`RUC: ${settings.ruc}`]);
  if (settings.address) addRow([settings.address]);
  if (settings.phone) addRow([`Tel: ${settings.phone}`]);
  addRow([]);

  // Quotation info
  addRow(["COTIZACIÓN", quotation.number]);
  addRow(["Fecha", formatDate(quotation.created_at)]);
  addRow(["Validez", `${quotation.validity_days} días`]);
  addRow([]);

  // Client info
  addRow(["CLIENTE", quotation.client_name]);
  if (quotation.client_ruc) addRow(["RUC", quotation.client_ruc]);
  if (quotation.client_address) addRow(["Dirección", quotation.client_address]);
  if (quotation.client_phone) addRow(["Teléfono", quotation.client_phone]);
  if (quotation.client_email) addRow(["Email", quotation.client_email]);
  addRow([]);

  // Items header
  addRow(["#", "Descripción", "Unidad", "Cantidad", "P.U. (S/)", "Subtotal (S/)"]);

  // Items
  items.forEach((item, i) => {
    buildQuotationItemLines(item).forEach((l, k) => {
      addRow([
        k === 0 ? i + 1 : "",
        k === 0 ? item.product_name : `   ↳ ${l.label}`,
        l.unit,
        l.quantity,
        l.unit_price,
        l.subtotal,
      ]);
    });
  });

  addRow([]);

  // Totals
  addRow(["", "", "", "", "Subtotal", Number(quotation.subtotal)]);
  const igvPct = (Number(quotation.igv_rate) * 100).toFixed(0);
  addRow(["", "", "", "", `IGV (${igvPct}%)`, Number(quotation.igv)]);
  addRow(["", "", "", "", "TOTAL", Number(quotation.total)]);

  // Notes
  if (quotation.notes) {
    addRow([]);
    addRow(["Observaciones:", quotation.notes]);
  }

  // Set column widths
  ws.columns = [
    { width: 5 },   // #
    { width: 40 },  // Description
    { width: 10 },  // Unit
    { width: 10 },  // Quantity
    { width: 15 },  // Unit price
    { width: 15 },  // Subtotal
  ];

  // Generate ArrayBuffer and trigger download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${quotation.number}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
