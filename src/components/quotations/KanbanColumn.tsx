import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard } from "./KanbanCard";
import type { Quotation } from "@/types";
import { formatCurrency, getStatusColor } from "@/lib/formatters";

interface KanbanColumnProps {
  id: string;
  title: string;
  quotations: Quotation[];
  onDuplicate: (q: Quotation) => void;
  onCreateRevision: (q: Quotation) => void;
  onExportPDF: (q: Quotation) => void;
  onDelete: (id: string) => void;
}

export function KanbanColumn({ id, title, quotations, onDuplicate, onCreateRevision, onExportPDF, onDelete }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  const columnTotal = quotations.reduce((sum, q) => sum + Number(q.total), 0);
  const statusColor = getStatusColor(id);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "320px",
        minWidth: "320px",
        height: "100%",
        minHeight: "500px",
        background: isOver ? "var(--bg-card-hover)" : "var(--bg-tertiary)",
        borderRadius: "var(--radius-lg)",
        padding: "0",
        transition: "background 0.2s ease, box-shadow 0.2s ease",
        boxShadow: isOver ? `0 0 0 2px ${statusColor}40` : "none",
        overflow: "hidden",
      }}
    >
      {/* Color accent stripe */}
      <div style={{ height: 4, background: statusColor, opacity: 0.7 }} />
      
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>{title}</h3>
            <span style={{ 
              background: `${statusColor}18`,
              color: statusColor,
              padding: "2px 10px", 
              borderRadius: "var(--radius-full)", 
              fontSize: "0.75rem",
              fontWeight: 700,
            }}>
              {quotations.length}
            </span>
          </div>
        </div>
        
        <div style={{ 
          fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "14px", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>Total:</span>
          <span>{formatCurrency(columnTotal)}</span>
        </div>
      </div>

      <div ref={setNodeRef} style={{ flex: 1, minHeight: "150px", padding: "0 16px 16px" }}>
        <SortableContext items={quotations.map(q => q.id)} strategy={verticalListSortingStrategy}>
          {quotations.map((q) => (
            <KanbanCard 
              key={q.id} 
              quotation={q} 
              onDuplicate={onDuplicate} 
              onCreateRevision={onCreateRevision}
              onExportPDF={onExportPDF} 
              onDelete={onDelete} 
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
