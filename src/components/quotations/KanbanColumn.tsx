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
  onExportPDF: (q: Quotation) => void;
  onDelete: (id: string) => void;
}

export function KanbanColumn({ id, title, quotations, onDuplicate, onExportPDF, onDelete }: KanbanColumnProps) {
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
        background: isOver ? "var(--surface-hover)" : "var(--surface-sunken)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
        transition: "background 0.2s ease"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: statusColor }} />
          <h3 style={{ margin: 0, fontSize: "1rem" }}>{title}</h3>
          <span style={{ 
            background: "var(--surface)", 
            padding: "2px 8px", 
            borderRadius: "12px", 
            fontSize: "0.8rem",
            color: "var(--text-secondary)"
          }}>
            {quotations.length}
          </span>
        </div>
      </div>
      
      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "16px", fontWeight: 500 }}>
        Total: {formatCurrency(columnTotal)}
      </div>

      <div ref={setNodeRef} style={{ flex: 1, minHeight: "150px" }}>
        <SortableContext items={quotations.map(q => q.id)} strategy={verticalListSortingStrategy}>
          {quotations.map((q) => (
            <KanbanCard 
              key={q.id} 
              quotation={q} 
              onDuplicate={onDuplicate} 
              onExportPDF={onExportPDF} 
              onDelete={onDelete} 
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
