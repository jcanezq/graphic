// ============================================================
// CotiGrafix — PDF Export (jsPDF + autoTable)
// ============================================================

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Quotation, CompanySettings } from "@/types";
import { formatCurrency, formatDate } from "@/lib/formatters";

export function generatePDF(quotation: Quotation, settings: CompanySettings) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Colors
  const primary = [99, 102, 241]; // accent violet
  const dark = [15, 23, 42];
  const gray = [100, 116, 139];

  // ── Header ──────────────────────────────────────────────
  // Company name
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text(settings.company_name || "Mi Empresa", margin, 22);

  // Company details
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  let yPos = 28;
  if (settings.ruc) {
    doc.text(`RUC: ${settings.ruc}`, margin, yPos);
    yPos += 4;
  }
  if (settings.address) {
    doc.text(settings.address, margin, yPos);
    yPos += 4;
  }
  if (settings.phone) {
    doc.text(`Tel: ${settings.phone}`, margin, yPos);
    yPos += 4;
  }
  if (settings.email) {
    doc.text(settings.email, margin, yPos);
  }

  // Quotation title (right side)
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text("COTIZACIÓN", pageWidth - margin, 22, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text(quotation.number, pageWidth - margin, 30, { align: "right" });

  // Divider
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, 42, pageWidth - margin, 42);

  // ── Quotation Info + Client ─────────────────────────────
  const infoY = 50;

  // Left - Quotation info
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("FECHA DE EMISIÓN", margin, infoY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(9);
  doc.text(formatDate(quotation.created_at), margin, infoY + 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("VÁLIDA HASTA", margin, infoY + 14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(9);
  const validUntil = new Date(quotation.created_at);
  validUntil.setDate(validUntil.getDate() + quotation.validity_days);
  doc.text(formatDate(validUntil.toISOString()), margin, infoY + 19);

  // Right - Client info
  const clientX = pageWidth / 2 + 10;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("CLIENTE", clientX, infoY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(10);
  doc.text(quotation.client_name, clientX, infoY + 6);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  let clientY = infoY + 12;
  if (quotation.client_ruc) {
    doc.text(`RUC: ${quotation.client_ruc}`, clientX, clientY);
    clientY += 4;
  }
  if (quotation.client_address) {
    doc.text(quotation.client_address, clientX, clientY);
    clientY += 4;
  }
  if (quotation.client_phone) {
    doc.text(`Tel: ${quotation.client_phone}`, clientX, clientY);
    clientY += 4;
  }
  if (quotation.client_email) {
    doc.text(quotation.client_email, clientX, clientY);
  }

  // ── Items Table ─────────────────────────────────────────
  const items = quotation.items || [];

  autoTable(doc, {
    startY: 78,
    head: [["#", "Descripción", "Und.", "Cant.", "P.U.", "Subtotal"]],
    body: items.map((item, i) => [
      String(i + 1),
      item.product_name + (item.product_description ? `\n${item.product_description}` : ""),
      item.unit,
      String(item.quantity),
      formatCurrency(item.unit_price),
      formatCurrency(item.subtotal),
    ]),
    theme: "plain",
    headStyles: {
      fillColor: [primary[0], primary[1], primary[2]],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 30, halign: "right" },
      5: { cellWidth: 32, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // ── Totals ──────────────────────────────────────────────
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  const totalsX = pageWidth - margin - 70;

  // Subtotal
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("Subtotal", totalsX, finalY);
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text(formatCurrency(Number(quotation.subtotal)), pageWidth - margin, finalY, {
    align: "right",
  });

  // IGV
  const igvPct = (Number(quotation.igv_rate) * 100).toFixed(0);
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text(`IGV (${igvPct}%)`, totalsX, finalY + 7);
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text(formatCurrency(Number(quotation.igv)), pageWidth - margin, finalY + 7, {
    align: "right",
  });

  // Total line
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 5, finalY + 11, pageWidth - margin, finalY + 11);

  // TOTAL
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text("TOTAL", totalsX, finalY + 19);
  doc.text(formatCurrency(Number(quotation.total)), pageWidth - margin, finalY + 19, {
    align: "right",
  });

  // ── Notes ───────────────────────────────────────────────
  if (quotation.notes) {
    const notesY = finalY + 32;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text("OBSERVACIONES", margin, notesY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(dark[0], dark[1], dark[2]);
    const splitNotes = doc.splitTextToSize(quotation.notes, pageWidth - margin * 2);
    doc.text(splitNotes, margin, notesY + 5);
  }

  // ── Footer ──────────────────────────────────────────────
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text(
    `${settings.company_name} · Cotización generada por CotiGrafix`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  // Save
  doc.save(`${quotation.number}.pdf`);
}
