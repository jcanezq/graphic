import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/formatters";
import type { Quotation } from "@/types";
import { Eye, Download, Copy, Trash2, Clock, AlertTriangle, GitBranch, MessageCircle, Globe } from "lucide-react";
import { generateAdminToClientWhatsAppUrl } from "@/lib/whatsapp";
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

  const showExpiry = quotation.status === "borrador" || quotation.status === "enviada" || quotation.status === "solicitada";
  const expiry = showExpiry ? getExpiryInfo(quotation) : null;
  const isWebRequest = quotation.status === "solicitada" || quotation.notes?.includes("[Solicitud Web");
  const whatsappUrl = quotation.client_phone
    ? generateAdminToClientWhatsAppUrl({
        clientPhone: quotation.client_phone,
        quotationNumber: quotation.number,
        clientName: quotation.client_name,
        total: quotation.total,
      })
    : null;

  return (
    <div
      ref={setNodeRef}
      className="card"
      style={{
        ...style,
        marginBottom: "8px",
        padding: "12px 14px",
        cursor: "grab",
        background: "var(--bg-secondary)",
        border: `1px solid ${isWebRequest ? "rgba(245, 158, 11, 0.4)" : expiry?.urgent ? `${expiry.color}40` : "var(--surface-border)"}`,
        boxShadow: isDragging ? "0 15px 40px rgba(0,0,0,0.35)" : undefined,
        touchAction: "none",
        borderRadius: "var(--radius-md)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      {...attributes}
      {...listeners}
    >
      {/* Header: Number + Date */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link 
            href={`/dashboard/cotizaciones/${quotation.id}`} 
            style={{ color: "var(--accent)", fontSize: "0.8rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {quotation.number}
          </Link>
          {isWebRequest && (
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                background: "rgba(245, 158, 11, 0.15)",
                color: "#d97706",
                padding: "1px 5px",
                borderRadius: "var(--radius-sm)",
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
              }}
              title="Solicitud generada por cliente desde la web"
            >
              <Globe size={10} /> Web
            </span>
          )}
        </div>
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

      {/* Expiry indicator */}
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
      
      {/* Amount */}
      <div style={{ marginBottom: "12px" }}>
        <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--success)", letterSpacing: "-0.02em" }}>
          {formatCurrency(Number(quotation.total))}
        </span>
      </div>
        
      {/* Actions inside card */}
      <div 
        style={{ 
          display: "flex", 
          gap: 4, 
          justifyContent: "flex-end", 
          paddingTop: "12px", 
          borderTop: "1px dashed var(--surface-border)" 
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-icon"
            title="Contactar al cliente por WhatsApp"
            style={{ color: "#25D366", padding: 6 }}
          >
            <MessageCircle size={14} />
          </a>
        )}
        <Link href={`/dashboard/cotizaciones/${quotation.id}`} className="btn-icon" title="Ver" style={{ padding: 6 }}>
          <Eye size={14} />
        </Link>
        <button className="btn-icon" title="Crear Revisión" onClick={() => onCreateRevision(quotation)} style={{ padding: 6 }}>
          <GitBranch size={14} />
        </button>
        <button className="btn-icon" title="Duplicar" onClick={() => onDuplicate(quotation)} style={{ padding: 6 }}>
          <Copy size={14} />
        </button>
        <button className="btn-icon" title="PDF" onClick={() => onExportPDF(quotation)} style={{ padding: 6 }}>
          <Download size={14} />
        </button>
        <button
          className="btn-icon"
          title="Eliminar"
          onClick={() => onDelete(quotation.id)}
          style={{ color: "var(--error)", padding: 6 }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
