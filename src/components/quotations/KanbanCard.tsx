import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/formatters";
import type { Quotation } from "@/types";
import { Eye, Download, Copy, Trash2, Clock, AlertTriangle, GitBranch } from "lucide-react";
import Link from "next/link";

interface KanbanCardProps {
  quotation: Quotation;
  onDuplicate: (q: Quotation) => void;
  onCreateRevision: (q: Quotation) => void;
  onExportPDF: (q: Quotation) => void;
  onDelete: (id: string) => void;
}

function getExpiryInfo(quotation: Quotation) {
  const createdAt = new Date(quotation.created_at);
  const expiryDate = new Date(createdAt.getTime() + quotation.validity_days * 24 * 60 * 60 * 1000);
  const now = new Date();
  const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  if (daysLeft < 0) return { label: "Vencida", color: "var(--error)", urgent: true, daysLeft };
  if (daysLeft === 0) return { label: "Vence hoy", color: "var(--error)", urgent: true, daysLeft };
  if (daysLeft <= 3) return { label: `${daysLeft}d restante${daysLeft !== 1 ? "s" : ""}`, color: "var(--error)", urgent: true, daysLeft };
  if (daysLeft <= 7) return { label: `${daysLeft}d restantes`, color: "var(--warning)", urgent: false, daysLeft };
  return { label: `${daysLeft}d vigente`, color: "var(--text-muted)", urgent: false, daysLeft };
}

export function KanbanCard({ quotation, onDuplicate, onCreateRevision, onExportPDF, onDelete }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: quotation.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const showExpiry = quotation.status === "borrador" || quotation.status === "enviada";
  const expiry = showExpiry ? getExpiryInfo(quotation) : null;
  const statusColor = getStatusColor(quotation.status);

  return (
    <div
      ref={setNodeRef}
      className="card"
      style={{
        ...style,
        marginBottom: "8px",
        padding: "12px 14px",
        cursor: "grab",
        background: "var(--surface)",
        border: `1px solid ${expiry?.urgent ? `${expiry.color}40` : "var(--surface-divider)"}`,
        boxShadow: isDragging ? "0 8px 20px rgba(0,0,0,0.12)" : "var(--shadow-sm)",
        touchAction: "none",
        borderRadius: "var(--radius-md)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      {...attributes}
      {...listeners}
    >
      {/* Header: Number + Date */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Link 
          href={`/dashboard/cotizaciones/${quotation.id}`} 
          style={{ color: "var(--accent)", fontSize: "0.8rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {quotation.number}
        </Link>
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
          {formatDate(quotation.created_at)}
        </span>
      </div>
      
      {/* Client name */}
      <h4 style={{ 
        margin: "0 0 8px 0", fontSize: "0.9rem", fontWeight: 600,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {quotation.client_name}
      </h4>

      {/* Expiry indicator (only for borrador/enviada) */}
      {expiry && (
        <div style={{ 
          display: "flex", alignItems: "center", gap: 5,
          fontSize: "0.72rem", fontWeight: 600,
          color: expiry.color,
          marginBottom: 8,
          padding: "3px 8px",
          background: `${expiry.color}10`,
          borderRadius: "var(--radius-sm)",
          width: "fit-content",
        }}>
          {expiry.urgent ? <AlertTriangle size={11} /> : <Clock size={11} />}
          {expiry.label}
        </div>
      )}
      
      {/* Footer: Amount + Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--success)" }}>
          {formatCurrency(Number(quotation.total))}
        </span>
        
        {/* Actions inside card (stop propagation so dragging doesn't trigger) */}
        <div 
          style={{ display: "flex", gap: 2 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Link href={`/dashboard/cotizaciones/${quotation.id}`} className="btn-icon" title="Ver" style={{ padding: 4 }}>
            <Eye size={13} />
          </Link>
          <button className="btn-icon" title="Crear Revisión" onClick={() => onCreateRevision(quotation)} style={{ padding: 4 }}>
            <GitBranch size={13} />
          </button>
          <button className="btn-icon" title="Duplicar" onClick={() => onDuplicate(quotation)} style={{ padding: 4 }}>
            <Copy size={13} />
          </button>
          <button className="btn-icon" title="PDF" onClick={() => onExportPDF(quotation)} style={{ padding: 4 }}>
            <Download size={13} />
          </button>
          <button
            className="btn-icon"
            title="Eliminar"
            onClick={() => onDelete(quotation.id)}
            style={{ color: "var(--error)", padding: 4 }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
