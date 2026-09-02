import React, { useState } from "react";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import type { Quotation } from "@/types";

interface KanbanBoardProps {
  quotations: Quotation[];
  setQuotations: React.Dispatch<React.SetStateAction<Quotation[]>>;
  onStatusChange: (id: string, newStatus: string) => Promise<void>;
  onDuplicate: (q: Quotation) => void;
  onExportPDF: (q: Quotation) => void;
  onDelete: (id: string) => void;
}

const COLUMNS = [
  { id: "borrador", title: "Borrador" },
  { id: "enviada", title: "Enviada" },
  { id: "aceptada", title: "Aceptada" },
  { id: "rechazada", title: "Rechazada" },
  { id: "vencida", title: "Vencida" }
];

export function KanbanBoard({ 
  quotations, 
  setQuotations, 
  onStatusChange,
  onDuplicate,
  onExportPDF,
  onDelete
}: KanbanBoardProps) {
  const [activeQuotation, setActiveQuotation] = useState<Quotation | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts to allow clicks
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const quot = quotations.find((q) => q.id === active.id);
    if (quot) setActiveQuotation(quot);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveAQuotation = active.data.current?.sortable;
    const isOverAQuotation = over.data.current?.sortable;

    if (!isActiveAQuotation) return;

    // Dropping a card over another card
    if (isActiveAQuotation && isOverAQuotation) {
      setQuotations((items) => {
        const activeIndex = items.findIndex((q) => q.id === activeId);
        const overIndex = items.findIndex((q) => q.id === overId);

        if (items[activeIndex].status !== items[overIndex].status) {
          const newItems = [...items];
          newItems[activeIndex].status = items[overIndex].status;
          return arrayMove(newItems, activeIndex, overIndex);
        }

        return arrayMove(items, activeIndex, overIndex);
      });
    }

    // Dropping a card over an empty column
    const isOverAColumn = COLUMNS.some(c => c.id === overId);
    if (isActiveAQuotation && isOverAColumn) {
      setQuotations((items) => {
        const activeIndex = items.findIndex((q) => q.id === activeId);
        const newItems = [...items];
        newItems[activeIndex].status = overId as Quotation["status"];
        return arrayMove(newItems, activeIndex, activeIndex);
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveQuotation(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const activeItem = quotations.find(q => q.id === activeId);
    
    // We already optimistically updated the status in handleDragOver
    // Now we need to persist it if it changed column
    if (activeItem) {
      // Look up what the final status is
      const finalStatus = activeItem.status;
      // We could track original vs new status, but easiest is to just call the API
      // Let's assume onStatusChange handles ignoring if it's the same, or we just fire it
      await onStatusChange(activeId, finalStatus);
    }
  }

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: "flex", gap: "24px", overflowX: "auto", padding: "16px 4px", minHeight: "500px" }}>
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            quotations={quotations.filter(q => q.status === col.id)}
            onDuplicate={onDuplicate}
            onExportPDF={onExportPDF}
            onDelete={onDelete}
          />
        ))}
      </div>
      
      <DragOverlay dropAnimation={dropAnimation}>
        {activeQuotation ? (
          <div style={{ transform: "rotate(3deg)" }}>
            <KanbanCard 
              quotation={activeQuotation} 
              onDuplicate={() => {}} 
              onExportPDF={() => {}} 
              onDelete={() => {}} 
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
