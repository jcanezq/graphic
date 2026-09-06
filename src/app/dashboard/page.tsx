import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatRelativeTime, getStatusLabel, getStatusColor } from "@/lib/formatters";
import { FileText, Package, TrendingUp, Plus, AlertTriangle, Users, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Link from "next/link";
import type { Quotation } from "@/types";
import DashboardCharts from "@/components/dashboard/DashboardCharts";

export const dynamic = 'force-dynamic';

interface StatusCount {
  status: string;
  count: number;
}

interface TopClient {
  client_name: string;
  total_amount: number;
  count: number;
}

export default async function DashboardPage() {
  const supabase = createClient();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  const [quotRes, monthRes, lastMonthRes, productsRes, recentRes, allQuotRes, topProductsRes] = await Promise.all([
    supabase.from("quotations").select("total", { count: "exact" }).is("deleted_at", null),
    supabase.from("quotations").select("id, total, status", { count: "exact" }).gte("created_at", firstOfMonth).is("deleted_at", null),
    supabase.from("quotations").select("id, total", { count: "exact" }).gte("created_at", firstOfLastMonth).lte("created_at", endOfLastMonth).is("deleted_at", null),
    supabase.from("products").select("id", { count: "exact" }).eq("is_active", true),
    supabase.from("quotations").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
    supabase.from("quotations").select("id, status, client_name, total, validity_days, created_at, number").is("deleted_at", null),
    supabase.from("quotation_items").select("product_name"),
  ]);

  const totalAmount = (quotRes.data || []).reduce(
    (sum: number, q: { total: number }) => sum + Number(q.total),
    0
  );

  const monthAmount = (monthRes.data || []).reduce(
    (sum: number, q: { total: number }) => sum + Number(q.total),
    0
  );

  const lastMonthAmount = (lastMonthRes.data || []).reduce(
    (sum: number, q: { total: number }) => sum + Number(q.total),
    0
  );

  const monthChange = lastMonthAmount > 0
    ? ((monthAmount - lastMonthAmount) / lastMonthAmount * 100)
    : monthAmount > 0 ? 100 : 0;

  // Status distribution
  const allQuotations = (allQuotRes.data || []) as Array<{
    id: string; status: string; client_name: string; total: number;
    validity_days: number; created_at: string; number: string;
  }>;

  const statusCounts: StatusCount[] = ['borrador', 'enviada', 'aceptada', 'rechazada', 'vencida'].map(status => ({
    status,
    count: allQuotations.filter(q => q.status === status).length,
  }));

  const totalQuotCount = allQuotations.length;
  const acceptedCount = statusCounts.find(s => s.status === 'aceptada')?.count || 0;
  const conversionRate = totalQuotCount > 0 ? (acceptedCount / totalQuotCount * 100) : 0;

  // Top 5 clients by total amount
  const clientMap = new Map<string, { total_amount: number; count: number }>();
  allQuotations.forEach(q => {
    const existing = clientMap.get(q.client_name) || { total_amount: 0, count: 0 };
    existing.total_amount += Number(q.total);
    existing.count += 1;
    clientMap.set(q.client_name, existing);
  });
  const topClients: TopClient[] = Array.from(clientMap.entries())
    .map(([client_name, data]) => ({ client_name, ...data }))
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, 5);

  // Expiring quotations (within 3 days)
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const expiringQuotations = allQuotations.filter(q => {
    if (q.status !== 'borrador' && q.status !== 'enviada') return false;
    const expiryDate = new Date(new Date(q.created_at).getTime() + q.validity_days * 24 * 60 * 60 * 1000);
    return expiryDate <= threeDaysFromNow && expiryDate >= now;
  });

  const metrics = {
    totalQuotations: quotRes.count || 0,
    monthQuotations: monthRes.count || 0,
    lastMonthQuotations: lastMonthRes.count || 0,
    totalAmount,
    monthAmount,
    totalProducts: productsRes.count || 0,
  };

  const recentQuotations = (recentRes.data as Quotation[]) || [];

  // ---- CHART DATA ----

  // Monthly data (last 6 months)
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthStart = d.toISOString();
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const monthQuots = allQuotations.filter(q => q.created_at >= monthStart && q.created_at <= monthEnd);
    return {
      month: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`,
      count: monthQuots.length,
      amount: monthQuots.reduce((sum, q) => sum + Number(q.total), 0),
    };
  });

  // Status data for pie chart
  const statusData = ['borrador', 'enviada', 'aceptada', 'rechazada', 'vencida'].map(status => ({
    name: getStatusLabel(status),
    value: allQuotations.filter(q => q.status === status).length,
    amount: allQuotations.filter(q => q.status === status).reduce((sum, q) => sum + Number(q.total), 0),
    color: getStatusColor(status),
  }));

  // Revenue data (accepted quotations per month, last 6 months)
  const revenueData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthStart = d.toISOString();
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const accepted = allQuotations.filter(q => q.status === 'aceptada' && q.created_at >= monthStart && q.created_at <= monthEnd);
    return {
      month: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`,
      count: accepted.length,
      amount: accepted.reduce((sum, q) => sum + Number(q.total), 0),
    };
  });

  // Top 5 products by quotation frequency
  const productFreqMap = new Map<string, number>();
  (topProductsRes.data || []).forEach((item: { product_name: string }) => {
    const name = item.product_name;
    productFreqMap.set(name, (productFreqMap.get(name) || 0) + 1);
  });
  const topProducts = Array.from(productFreqMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

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
            <div className="metric-value">{formatCurrency(metrics.monthAmount)}</div>
            <div className="metric-label">Monto Este Mes</div>
            {lastMonthAmount > 0 && (
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
            <div className="metric-value">{conversionRate.toFixed(1)}%</div>
            <div className="metric-label">Tasa de Conversión</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
              {acceptedCount} aceptadas de {totalQuotCount}
            </div>
          </div>
        </div>

        {/* Interactive Charts */}
        <DashboardCharts
          monthlyData={monthlyData}
          statusData={statusData}
          revenueData={revenueData}
          topProducts={topProducts}
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
                {topClients.map((client, i) => (
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
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {client.count} cotizacion{client.count !== 1 ? "es" : ""}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--success)", whiteSpace: "nowrap" }}>
                      {formatCurrency(client.total_amount)}
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
            {expiringQuotations.length === 0 ? (
              <div style={{ padding: "2rem", color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center" }}>
                ✅ No hay cotizaciones próximas a vencer
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {expiringQuotations.slice(0, 5).map((q) => {
                  const expiryDate = new Date(new Date(q.created_at).getTime() + q.validity_days * 24 * 60 * 60 * 1000);
                  const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
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
                        background: daysLeft <= 1 ? "var(--error-light)" : "var(--warning-light)",
                        color: daysLeft <= 1 ? "var(--error)" : "var(--warning)",
                      }}>
                        {daysLeft <= 0 ? "Vence hoy" : `${daysLeft} día${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""}`}
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
