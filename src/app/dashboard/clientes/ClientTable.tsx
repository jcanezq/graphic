"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { Search, Users, Eye, Trash2, Edit2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, formatRelativeTime } from "@/lib/formatters";
import type { Client } from "@/types";
import ClientModal from "./ClientModal";

interface ClientWithStats extends Client {
  ltv?: number;
  quoteCount?: number;
  lastQuoteDate?: string;
}

interface Props {
  initialClients: ClientWithStats[];
}

export default function ClientTable({ initialClients }: Props) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [clients, setClients] = useState(initialClients);

  // Sync state when initialClients changes (e.g. after router.refresh())
  useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);
  const supabase = createClient();
  const { showToast } = useToast();
  const router = useRouter();
  const PAGE_SIZE = 20;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<ClientWithStats | null>(null);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const s = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(s) ||
        (c.ruc && c.ruc.includes(s)) ||
        (c.email && c.email.toLowerCase().includes(s))
      );
    });
  }, [clients, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Desactivar al cliente "${name}"? El cliente pasará a un estado inactivo.`)) return;
    const { error } = await supabase.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      showToast("Error al desactivar: " + error.message, "error");
    } else {
      setClients(prev => prev.filter(c => c.id !== id));
      showToast("Cliente desactivado correctamente");
    }
  }

  return (
    <>
      <div className="toolbar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre, RUC o correo..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setClientToEdit(null);
            setIsModalOpen(true);
          }}
        >
          + Nuevo Cliente
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="card empty-state">
          <Users size={48} />
          <h3>No hay clientes registrados</h3>
          <p>Los clientes se guardan automáticamente al crear una nueva cotización.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <Search size={48} />
          <h3>Sin resultados</h3>
          <p>No se encontraron clientes que coincidan con &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>RUC</th>
                  <th>Teléfono</th>
                  <th>Cotizaciones</th>
                  <th>Total Cotizado</th>
                  <th>Última Cotización</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((c) => (
                  <tr key={c.id}>
                    <td className="primary">
                      <Link href={`/dashboard/clientes/${c.id}`} style={{ color: "var(--text-primary)" }}>
                        {c.name}
                      </Link>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                      {c.ruc || "-"}
                    </td>
                    <td>{c.phone || "-"}</td>
                    <td>
                      {c.quoteCount != null ? (
                        <span className="badge" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                          {c.quoteCount}
                        </span>
                      ) : "-"}
                    </td>
                    <td style={{ fontWeight: 600, color: (c.ltv && c.ltv > 0) ? "var(--success)" : "var(--text-muted)" }}>
                      {c.ltv != null && c.ltv > 0 ? formatCurrency(c.ltv) : "-"}
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      {c.lastQuoteDate ? formatRelativeTime(c.lastQuoteDate) : "-"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <Link href={`/dashboard/clientes/${c.id}`} className="btn-icon" title="Ver Perfil">
                          <Eye size={15} />
                        </Link>
                        <button
                          className="btn-icon"
                          title="Editar"
                          onClick={() => {
                            setClientToEdit(c);
                            setIsModalOpen(true);
                          }}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Eliminar"
                          onClick={() => handleDelete(c.id, c.name)}
                          style={{ color: "var(--error)" }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderTop: "1px solid var(--surface-divider)",
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
            }}>
              <span>
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} clientes
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  ← Anterior
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        client={clientToEdit}
        onSuccess={() => {
          // Si quisieras actualizar el estado local sin recargar:
          // router.refresh() ya se llama en el modal.
        }}
      />
    </>
  );
}
