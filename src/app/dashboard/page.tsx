import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatRelativeTime, getStatusLabel, getStatusColor } from "@/lib/formatters";
import { FileText, Package, TrendingUp, Plus, DollarSign } from "lucide-react";
import Link from "next/link";
import type { Quotation } from "@/types";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [quotRes, monthRes, productsRes, recentRes] = await Promise.all([
    supabase.from("quotations").select("total", { count: "exact" }),
    supabase.from("quotations").select("id", { count: "exact" }).gte("created_at", firstOfMonth),
    supabase.from("products").select("id", { count: "exact" }).eq("is_active", true),
    supabase.from("quotations").select("*").order("created_at", { ascending: false }).limit(5),
  ]);

  const totalAmount = (quotRes.data || []).reduce(
    (sum: number, q: { total: number }) => sum + Number(q.total),
    0
  );

  const metrics = {
    totalQuotations: quotRes.count || 0,
    monthQuotations: monthRes.count || 0,
    totalAmount,
    totalProducts: productsRes.count || 0,
  };

  const recentQuotations = (recentRes.data as Quotation[]) || [];



  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Resumen general de tu negocio</p>
        </div>
        <div className="page-header-actions">
          <Link href="/dashboard/cotizaciones/nueva" className="btn btn-primary">
            <Plus size={18} />
            Nueva Cotización
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* Metric Cards */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div
              className="metric-icon"
              style={{ background: "var(--accent-light)", color: "var(--accent)" }}
            >
              <FileText size={22} />
            </div>
            <div className="metric-value">{metrics.totalQuotations}</div>
            <div className="metric-label">Total Cotizaciones</div>
          </div>

          <div className="metric-card">
            <div
              className="metric-icon"
              style={{ background: "var(--info-light)", color: "var(--info)" }}
            >
              <TrendingUp size={22} />
            </div>
            <div className="metric-value">{metrics.monthQuotations}</div>
            <div className="metric-label">Este Mes</div>
          </div>

          <div className="metric-card">
            <div
              className="metric-icon"
              style={{ background: "var(--success-light)", color: "var(--success)" }}
            >
              <DollarSign size={22} />
            </div>
            <div className="metric-value">{formatCurrency(metrics.totalAmount)}</div>
            <div className="metric-label">Monto Total</div>
          </div>

          <div className="metric-card">
            <div
              className="metric-icon"
              style={{ background: "var(--warning-light)", color: "var(--warning)" }}
            >
              <Package size={22} />
            </div>
            <div className="metric-value">{metrics.totalProducts}</div>
            <div className="metric-label">Productos Activos</div>
          </div>
        </div>

        {/* Recent Quotations */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Cotizaciones Recientes</h3>
            <Link href="/dashboard/cotizaciones" className="btn btn-ghost btn-sm">
              Ver todas
            </Link>
          </div>

          {recentQuotations.length === 0 ? (
            <div className="empty-state" style={{ padding: "2rem" }}>
              <FileText size={40} />
              <h3>Sin cotizaciones aún</h3>
              <p>Crea tu primera cotización para verla aquí.</p>
              <Link href="/dashboard/cotizaciones/nueva" className="btn btn-primary">
                <Plus size={16} />
                Nueva Cotización
              </Link>
            </div>
          ) : (
            <div className="table-container" style={{ border: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>N° Cotización</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {recentQuotations.map((q) => (
                    <tr key={q.id}>
                      <td className="primary">
                        <Link href={`/dashboard/cotizaciones/${q.id}`} style={{ color: "var(--accent)" }}>
                          {q.number}
                        </Link>
                      </td>
                      <td className="primary">{q.client_name}</td>
                      <td>{formatCurrency(Number(q.total))}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: `${getStatusColor(q.status)}20`,
                            color: getStatusColor(q.status),
                          }}
                        >
                          {getStatusLabel(q.status)}
                        </span>
                      </td>
                      <td>{formatRelativeTime(q.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
