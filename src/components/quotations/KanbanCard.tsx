import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Quotation } from "@/types";
import { Eye, Download, Copy, Trash2 } from "lucide-react";
import Link from "next/link";

interface KanbanCardProps {
  quotation: Quotation;
  onDuplicate: (q: Quotation) => void;
  onExportPDF: (q: Quotation) => void;
  onDelete: (id: string) => void;
}

export function KanbanCard({ quotation, onDuplicate, onExportPDF, onDelete }: KanbanCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      className="card"
      style={{
        ...style,
        marginBottom: "8px",
        padding: "12px",
        cursor: "grab",
        background: "var(--surface)",
        border: "1px solid var(--surface-divider)",
        boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.1)" : "none",
        touchAction: "none"
      }}
      {...attributes}
      {...listeners}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <Link href={`/dashboard/cotizaciones/${quotation.id}`} style={{ color: "var(--accent)", fontSize: "0.85rem", fontWeight: 600 }}>
          {quotation.number}
        </Link>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          {formatDate(quotation.created_at)}
        </span>
      </div>
      
      <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem" }}>{quotation.client_name}</h4>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, color: "var(--success)" }}>
          {formatCurrency(Number(quotation.total))}
        </span>
        
        {/* Actions inside card (stop propagation so dragging doesn't trigger) */}
        <div 
          style={{ display: "flex", gap: 4 }}
          onPointerDown={(e) => e.stopPropagation()} // Prevent dragging when clicking buttons
        >
          <Link href={`/dashboard/cotizaciones/${quotation.id}`} className="btn-icon" title="Ver" style={{ padding: 4 }}>
            <Eye size={14} />
          </Link>
          <button className="btn-icon" title="Duplicar" onClick={() => onDuplicate(quotation)} style={{ padding: 4 }}>
            <Copy size={14} />
          </button>
          <button className="btn-icon" title="PDF" onClick={() => onExportPDF(quotation)} style={{ padding: 4 }}>
            <Download size={14} />
          </button>
          <button
            className="btn-icon"
            title="Eliminar"
            onClick={() => onDelete(quotation.id)}
            style={{ color: "var(--error)", padding: 4 }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
