// ============================================================
// CotiGrafix — Excel Export (SheetJS / xlsx)
// ============================================================

import * as XLSX from "xlsx";
import type { Quotation, CompanySettings } from "@/types";
import { formatDate } from "@/lib/formatters";

export function generateExcel(quotation: Quotation, settings: CompanySettings) {
  const wb = XLSX.utils.book_new();
  const items = quotation.items || [];

  // Build data rows
  const data: (string | number)[][] = [];

  // Header rows
  data.push([settings.company_name || "Mi Empresa"]);
  if (settings.ruc) data.push([`RUC: ${settings.ruc}`]);
  if (settings.address) data.push([settings.address]);
  if (settings.phone) data.push([`Tel: ${settings.phone}`]);
  data.push([]);

  // Quotation info
  data.push(["COTIZACIÓN", quotation.number]);
  data.push(["Fecha", formatDate(quotation.created_at)]);
  data.push(["Validez", `${quotation.validity_days} días`]);
  data.push([]);

  // Client info
  data.push(["CLIENTE", quotation.client_name]);
  if (quotation.client_ruc) data.push(["RUC", quotation.client_ruc]);
  if (quotation.client_address) data.push(["Dirección", quotation.client_address]);
  if (quotation.client_phone) data.push(["Teléfono", quotation.client_phone]);
  if (quotation.client_email) data.push(["Email", quotation.client_email]);
  data.push([]);

  // Items header
  data.push(["#", "Descripción", "Unidad", "Cantidad", "P.U. (S/)", "Subtotal (S/)"]);

  // Items
  items.forEach((item, i) => {
    data.push([
      i + 1,
      item.product_name,
      item.unit,
      item.quantity,
      Number(item.unit_price),
      Number(item.subtotal),
    ]);
  });

  data.push([]);

  // Totals
  const subtotalRow = data.length;
  data.push(["", "", "", "", "Subtotal", Number(quotation.subtotal)]);
  const igvPct = (Number(quotation.igv_rate) * 100).toFixed(0);
  data.push(["", "", "", "", `IGV (${igvPct}%)`, Number(quotation.igv)]);
  data.push(["", "", "", "", "TOTAL", Number(quotation.total)]);

  // Notes
  if (quotation.notes) {
    data.push([]);
    data.push(["Observaciones:", quotation.notes]);
  }

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws["!cols"] = [
    { wch: 5 },   // #
    { wch: 40 },  // Description
    { wch: 10 },  // Unit
    { wch: 10 },  // Quantity
    { wch: 15 },  // Unit price
    { wch: 15 },  // Subtotal
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Cotización");

  // Save file
  XLSX.writeFile(wb, `${quotation.number}.xlsx`);
}
