// ============================================================
// CotiGrafix — Formatters
// ============================================================

/**
 * Format a number as Peruvian Soles currency.
 * e.g. 1234.5 → "S/ 1,234.50"
 */
export function formatCurrency(amount: number): string {
  return `S/ ${amount.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a number as currency without the symbol.
 * e.g. 1234.5 → "1,234.50"
 */
export function formatNumber(amount: number, decimals: number = 2): string {
  return amount.toLocaleString('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a date string to Peruvian locale.
 * e.g. "2026-08-31" → "31/08/2026"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a date string to long format.
 * e.g. "2026-08-31" → "31 de agosto de 2026"
 */
export function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format a date as relative time.
 * e.g. "hace 2 horas", "hace 3 días"
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'ahora mismo';
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return formatDate(dateStr);
}

/**
 * Generate a quotation number.
 * e.g. "COT-2026-0001"
 */
export function generateQuotationNumber(prefix: string, nextNumber: number): string {
  const year = new Date().getFullYear();
  const padded = String(nextNumber).padStart(4, '0');
  return `${prefix}-${year}-${padded}`;
}

/**
 * Get a status label in Spanish.
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    borrador: 'Generada',
    enviada: 'Enviada',
    aceptada: 'Aceptada',
    rechazada: 'Rechazada',
    vencida: 'Vencida',
  };
  return labels[status] || status;
}

/**
 * Get a status color class.
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    borrador: '#94a3b8',
    enviada: '#3b82f6',
    aceptada: '#10b981',
    rechazada: '#ef4444',
    vencida: '#f59e0b',
  };
  return colors[status] || '#94a3b8';
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}
