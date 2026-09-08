// ============================================================
// CotiGrafix — WhatsApp Notification & Deep-link Utilities
// ============================================================

export function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  // Keep only digits
  const cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return "";

  // If 9 digits starting with 9 (standard Peru mobile number), prepend 51
  if (cleaned.length === 9 && cleaned.startsWith("9")) {
    return `51${cleaned}`;
  }

  return cleaned;
}

export interface WhatsAppQuotationItemSummary {
  name: string;
  quantity: number;
  unit?: string;
  subtotal?: number;
}

/**
 * Generates WhatsApp URL for client to contact the business / advisor
 * to confirm their requested quotation.
 */
export function generateClientToAdminWhatsAppUrl(params: {
  adminPhone?: string | null;
  quotationNumber: string;
  clientName: string;
  total: number;
  items?: WhatsAppQuotationItemSummary[];
}): string {
  // Default fallback business phone if company settings hasn't set one yet
  const targetPhone = cleanPhoneNumber(params.adminPhone) || "51999999999";

  let itemsList = "";
  if (params.items && params.items.length > 0) {
    itemsList = params.items
      .map((it) => `• ${it.quantity} ${it.unit || "und"} - ${it.name}`)
      .join("\n");
  }

  const message = [
    `¡Hola CotiGrafic! 👋`,
    `Acabo de generar la *Solicitud de Cotización #${params.quotationNumber}* a nombre de *${params.clientName}*.`,
    ``,
    itemsList ? `📦 *Detalle del pedido:*\n${itemsList}\n` : null,
    `💰 *Monto estimado preliminar:* S/ ${params.total.toFixed(2)}`,
    `⚠️ *(Sujeto a confirmación técnica)*`,
    ``,
    `Deseo coordinar la confirmación y detalles del trabajo. ¡Muchas gracias!`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generates WhatsApp URL for admin to contact the client regarding their quote.
 */
export function generateAdminToClientWhatsAppUrl(params: {
  clientPhone?: string | null;
  quotationNumber: string;
  clientName: string;
  total: number;
}): string {
  const targetPhone = cleanPhoneNumber(params.clientPhone);
  if (!targetPhone) return "";

  const message = [
    `¡Hola ${params.clientName}! 👋 Te saludamos de *CotiGrafic*.`,
    ``,
    `Hemos recibido tu solicitud de cotización *#${params.quotationNumber}* por un monto de *S/ ${params.total.toFixed(2)}*.`,
    ``,
    `Queremos coordinar contigo los detalles para validar las medidas, materiales y pasar tu orden a producción.`,
    `¿Tienes alguna duda o requerimiento adicional? Estamos atentos para ayudarte.`,
  ].join("\n");

  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
}
