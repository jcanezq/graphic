"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";

interface MonthlyData {
  month: string;
  count: number;
  amount: number;
}

interface StatusData {
  name: string;
  value: number;
  amount: number;
  color: string;
}

interface TopProductData {
  name: string;
  count: number;
}

interface DashboardChartsProps {
  monthlyData: MonthlyData[];
  statusData: StatusData[];
  revenueData: MonthlyData[];
  topProducts: TopProductData[];
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "var(--bg-elevated)",
  border: "1px solid var(--surface-border)",
  borderRadius: 10,
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  fontSize: "0.82rem",
  padding: "8px 12px",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color || p.fill }} />
          <span style={{ color: "var(--text-secondary)" }}>
            {p.name}: {typeof p.value === "number" && p.name.toLowerCase().includes("monto")
              ? formatCurrency(p.value)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: d.payload.color }}>
        {d.payload.name}
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        {d.value} cotización{d.value !== 1 ? "es" : ""}
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        {formatCurrency(d.payload.amount)}
      </div>
    </div>
  );
}

export default function DashboardCharts({ monthlyData, statusData, revenueData, topProducts }: DashboardChartsProps) {
  const hasMonthlyData = monthlyData.some(d => d.count > 0);
  const hasRevenueData = revenueData.some(d => d.amount > 0);
  const hasStatusData = statusData.some(d => d.value > 0);
  const maxProductCount = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.count)) : 1;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)", marginBottom: "var(--space-2xl)" }}>
      
      {/* Monthly Quotations Bar Chart */}
      <div className="chart-card">
        <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
          Cotizaciones por Mes
        </h3>
        {hasMonthlyData ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-divider)" vertical={false} />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={{ stroke: "var(--surface-divider)" }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="count" 
                name="Cotizaciones"
                fill="var(--accent)" 
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Sin datos suficientes
          </div>
        )}
      </div>

      {/* Status Distribution Pie Chart */}
      <div className="chart-card">
        <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
          Distribución por Estado
        </h3>
        {hasStatusData ? (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <Pie
                  data={statusData.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {statusData.filter(d => d.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              {statusData.filter(d => d.value > 0).map(s => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                  <span style={{ color: "var(--text-secondary)", flex: 1 }}>{s.name}</span>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Sin datos suficientes
          </div>
        )}
      </div>

      {/* Revenue Area Chart */}
      <div className="chart-card">
        <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
          Ingresos Proyectados (Aceptadas)
        </h3>
        {hasRevenueData ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-divider)" vertical={false} />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={{ stroke: "var(--surface-divider)" }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip
                formatter={(value: any) => [formatCurrency(Number(value)), "Monto"]}
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}
              />
              <Area 
                type="monotone" 
                dataKey="amount" 
                name="Monto"
                stroke="#059669" 
                strokeWidth={2.5}
                fill="url(#revenueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Sin cotizaciones aceptadas
          </div>
        )}
      </div>

      {/* Top Products */}
      <div className="chart-card">
        <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
          Productos Más Cotizados
        </h3>
        {topProducts.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topProducts.map((p, i) => (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "var(--radius-full)",
                  background: i === 0 ? "var(--accent-gradient)" : "var(--bg-tertiary)",
                  color: i === 0 ? "white" : "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    marginBottom: 4,
                  }}>
                    {p.name}
                  </div>
                  <div style={{ 
                    height: 6, background: "var(--bg-tertiary)", borderRadius: 3, overflow: "hidden" 
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${(p.count / maxProductCount) * 100}%`,
                      background: i === 0 ? "var(--accent)" : `var(--accent)`,
                      opacity: 1 - (i * 0.15),
                      borderRadius: 3,
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--accent)", whiteSpace: "nowrap" }}>
                  {p.count}x
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Sin datos de productos
          </div>
        )}
      </div>
    </div>
  );
}
