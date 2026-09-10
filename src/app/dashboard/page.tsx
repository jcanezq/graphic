import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatRelativeTime, getStatusLabel, getStatusColor } from "@/lib/formatters";
import { FileText, Package, TrendingUp, Plus, AlertTriangle, Users, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Link from "next/link";
import type { Quotation } from "@/types";
import DashboardCharts from "@/components/dashboard/DashboardChartsLazy";
import { unwrapList } from "@/lib/supabase/unwrap";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();

  const [metricsRes, recentRes, productsRes] = await Promise.all([
    supabase.rpc('dashboard_metrics'),
    supabase.from("quotations").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
    supabase.from("products").select("id", { count: "exact" }).eq("is_active", true),
  ]);

  const metricsData = metricsRes.data as any || {
    total_revenue: 0,
    total_quotations: 0,
    by_status: {},
    top_clients: [],
    expiring_soon: [],
    monthly_series: []
  };

  const totalAmount = metricsData.total_revenue || 0;
  const totalQuotations = metricsData.total_quotations || 0;
  const byStatus = metricsData.by_status || {};
  const acceptedCount = byStatus['aceptada'] || 0;
  const conversionRate = totalQuotations > 0 ? (acceptedCount / totalQuotations * 100) : 0;
  
  const topClients = metricsData.top_clients || [];
  const expiringSoon = metricsData.expiring_soon || [];
  const monthlySeries = metricsData.monthly_series || [];

  // For month changes, we can calculate from the series
  const currentMonthData = monthlySeries.length > 0 ? monthlySeries[monthlySeries.length - 1] : { revenue: 0, count: 0 };
  const lastMonthData = monthlySeries.length > 1 ? monthlySeries[monthlySeries.length - 2] : { revenue: 0, count: 0 };
  
  const monthChange = lastMonthData.revenue > 0
    ? ((currentMonthData.revenue - lastMonthData.revenue) / lastMonthData.revenue * 100)
    : currentMonthData.revenue > 0 ? 100 : 0;

  const recentQuotations = unwrapList<Quotation>(recentRes as any, "dashboard.recent_quotations");

  // Format data for charts
  const statusData = ['borrador', 'enviada', 'aceptada', 'rechazada', 'vencida'].map(status => ({
    name: getStatusLabel(status),
    value: byStatus[status] || 0,
    amount: 0,
    color: getStatusColor(status),
  }));

  const monthlyData = monthlySeries.map((m: any) => ({
    month: m.month, // YYYY-MM
    count: m.count,
    amount: m.revenue,
  }));

  const metrics = {
    totalQuotations,
    monthQuotations: currentMonthData.count,
    lastMonthQuotations: lastMonthData.count,
    totalAmount,
    monthAmount: currentMonthData.revenue,
    totalProducts: productsRes.count || 0,
  };

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
            <div className="metric-value gradient-text">{metrics.totalQuotations}</div>
            <div className="metric-label">Total Cotizaciones</div>
          </div>

          <div className="metric-card">
            <div
              className="metric-icon"
              style={{ background: "var(--info-light)", color: "var(--info)" }}
            >
              <TrendingUp size={22} />
            </div>
            <div className="metric-value gradient-text">{metrics.monthQuotations}</div>
            <div className="metric-label">Este Mes</div>
            {metrics.lastMonthQuotations > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: "0.75rem", fontWeight: 600, marginTop: 4,
                color: (metrics.monthQuotations >= metrics.lastMonthQuotations) ? "var(--success)" : "var(--error)",
              }}>
                {metrics.monthQuotations >= metrics.lastMonthQuotations
                  ? <ArrowUpRight size={14} />
                  : <ArrowDownRight size={14} />
                }
                vs {metrics.lastMonthQuotations} el mes pasado
              </div>
            )}
          </div>

          <div className="metric-card">
            <div
              className="metric-icon"
              style={{ background: "var(--success-light)", color: "var(--success)" }}
            >
              <span style={{ fontSize: 18, fontWeight: 700 }}>S/</span>
            </div>
            <div className="metric-value gradient-text">{formatCurrency(metrics.monthAmount)}</div>
            <div className="metric-label">Monto Este Mes</div>
            {lastMonthData.revenue > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: "0.75rem", fontWeight: 600, marginTop: 4,
                color: monthChange >= 0 ? "var(--success)" : "var(--error)",
              }}>
                {monthChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {monthChange >= 0 ? "+" : ""}{monthChange.toFixed(0)}% vs mes anterior
              </div>
            )}
          </div>

          <div className="metric-card">
            <div
              className="metric-icon"
              style={{ background: "var(--warning-light)", color: "var(--warning)" }}
            >
              <BarChart3 size={22} />
            </div>
            <div className="metric-value gradient-text">{conversionRate.toFixed(1)}%</div>
            <div className="metric-label">Tasa de Aceptación</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
              {acceptedCount} aceptadas de {totalQuotations}
            </div>
          </div>
        </div>

        {/* Interactive Charts */}
        <DashboardCharts
          monthlyData={monthlyData}
          statusData={statusData}
          revenueData={monthlyData}
          topProducts={[]}
        />

        {/* Top Clients */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)", marginBottom: "var(--space-2xl)" }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Top Clientes</h3>
              <Link href="/dashboard/clientes" className="btn btn-ghost btn-sm">
                Ver todos
              </Link>
            </div>
            {topClients.length === 0 ? (
              <div style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center" }}>
                Sin datos de clientes aún
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topClients.map((client: any, i: number) => (
                  <div key={client.client_name} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 10px", borderRadius: "var(--radius-md)",
                    background: i === 0 ? "var(--accent-light)" : "transparent",
                    transition: "background 0.15s",
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "var(--radius-full)",
                      background: i === 0 ? "var(--accent-gradient)" : "var(--bg-tertiary)",
                      color: i === 0 ? "white" : "var(--text-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {client.client_name}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--success)", whiteSpace: "nowrap" }}>
                      {formatCurrency(client.ltv)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expiring Quotations */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
                Próximas a Vencer
              </h3>
            </div>
            {expiringSoon.length === 0 ? (
              <div style={{ padding: "2rem", color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center" }}>
                ✅ No hay cotizaciones próximas a vencer
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {expiringSoon.map((q: any) => {
                  return (
                    <Link
                      key={q.id}
                      href={`/dashboard/cotizaciones/${q.id}`}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 12px", borderRadius: "var(--radius-md)",
                        background: "var(--warning-light)",
                        textDecoration: "none", color: "inherit",
                        transition: "transform 0.15s",
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                          {q.number}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginLeft: 8 }}>
                          {q.client_name}
                        </span>
                      </div>
                      <span className="badge" style={{
                        background: "var(--warning-light)",
                        color: "var(--warning)",
                      }}>
                        {new Date(q.expires_at).toLocaleDateString()}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
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
