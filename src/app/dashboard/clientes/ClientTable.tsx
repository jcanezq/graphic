"use client";

import { useState, useMemo } from "react";
import { Search, Users, Eye } from "lucide-react";
import Link from "next/link";
import type { Client } from "@/types";

interface Props {
  initialClients: Client[];
}

export default function ClientTable({ initialClients }: Props) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const filtered = useMemo(() => {
    return initialClients.filter((c) => {
      const s = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(s) ||
        (c.ruc && c.ruc.includes(s)) ||
        (c.email && c.email.toLowerCase().includes(s))
      );
    });
  }, [initialClients, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
      </div>

      {initialClients.length === 0 ? (
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
                  <th>Correo</th>
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
                    <td>{c.email || "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <Link href={`/dashboard/clientes/${c.id}`} className="btn-icon" title="Ver Perfil">
                          <Eye size={15} />
                        </Link>
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
    </>
  );
}
