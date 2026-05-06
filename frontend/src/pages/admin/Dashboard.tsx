import { formatCOP } from '../../utils/constants';
// ============================================================
// frontend/src/pages/admin/Dashboard.tsx  →  /admin/dashboard
//
// FIX: recharts no está instalado en el proyecto.
// Las gráficas se reemplazan con barras CSS nativas que no
// requieren ninguna dependencia externa.
// ============================================================

import { useEffect } from 'react';
import AdminLayout       from '../../components/admin/AdminLayout';
import { useAdminStore } from '../../store/adminStore';
import { getAdminStats } from '../../services/adminService';
import '../../styles/admin.css';

const fmtMoney = (v: number) => formatCOP(v);

// ── Barra horizontal simple en CSS puro ─────────────────────
function BarChart({
  data,
  valueKey,
  labelKey,
  color,
}: {
  data: Record<string, unknown>[];
  valueKey: string;
  labelKey: string;
  color: string;
}) {
  if (!data.length) return <p className="chart-empty">Sin datos para hoy</p>;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className="native-bar-chart">
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        const label = String(d[labelKey]);
        return (
          <div key={i} className="nbc-row">
            <span className="nbc-label">{label}</span>
            <div className="nbc-track">
              <div
                className="nbc-fill"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <span className="nbc-value">{fmtMoney(val)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Donut simple en CSS ──────────────────────────────────────
const COLORS = ['#818cf8', '#34d399', '#f97316', '#f59e0b', '#ec4899', '#06b6d4'];

function PieList({ data }: { data: { category: string; revenue: number; qty: number }[] }) {
  if (!data.length) return <p className="chart-empty">Sin datos para hoy</p>;
  const total = data.reduce((s, d) => s + d.revenue, 0) || 1;
  return (
    <div className="pie-list">
      {data.map((d, i) => (
        <div key={d.category} className="pl-row">
          <span className="pl-dot" style={{ background: COLORS[i % COLORS.length] }} />
          <span className="pl-name">{d.category}</span>
          <span className="pl-qty">{d.qty} uds.</span>
          <span className="pl-pct">{((d.revenue / total) * 100).toFixed(0)}%</span>
          <span className="pl-amount">{fmtMoney(d.revenue)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { stats, statsLoading, setStats, setStatsLoading, setError } = useAdminStore();

  function load() {
    setStatsLoading(true);
    getAdminStats()
      .then(setStats)
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  // Formatear hora
  const fmtHour = (h: number) => `${String(h).padStart(2, '0')}h`;

  return (
    <AdminLayout>
      <div className="admin-page">
        {/* Header */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Dashboard</h1>
            <p className="admin-page-sub">
              {new Date().toLocaleDateString('es', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
          <button
            type="button"
            className="admin-refresh-btn"
            onClick={load}
            disabled={statsLoading}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
              style={statsLoading ? { animation: 'adminSpin 0.8s linear infinite' } : undefined}>
              <path d="M13 7.5A5.5 5.5 0 112.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M13 3.5v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Actualizar
          </button>
        </div>

        {statsLoading && !stats ? (
          <div className="admin-loading">
            <div className="admin-spinner" />
            <p>Cargando métricas...</p>
          </div>
        ) : stats ? (
          <>
            {/* ── KPI Cards ── */}
            <div className="kpi-grid">
              <div className="kpi-card kpi-primary">
                <span className="kpi-label">Órdenes hoy</span>
                <span className="kpi-value">{stats.today.orders}</span>
                <span className="kpi-sub">{stats.today.cancelledOrders} canceladas</span>
              </div>
              <div className="kpi-card kpi-green">
                <span className="kpi-label">Ventas totales</span>
                <span className="kpi-value">{fmtMoney(stats.today.revenue)}</span>
                <span className="kpi-sub">Ticket prom: {fmtMoney(stats.today.avgTicket)}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Mesa top</span>
                <span className="kpi-value">
                  {stats.topTable.number ? `Mesa ${stats.topTable.number}` : '—'}
                </span>
                <span className="kpi-sub">
                  {stats.topTable.section ?? ''} · {stats.topTable.orders} órdenes
                </span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Ítem más pedido</span>
                <span className="kpi-value kpi-value-sm">{stats.topItem.name ?? '—'}</span>
                <span className="kpi-sub">
                  {stats.topItem.category ?? ''} · {stats.topItem.qty} uds.
                </span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Mesero top</span>
                <span className="kpi-value kpi-value-sm">{stats.topWaiter.name ?? '—'}</span>
                <span className="kpi-sub">{stats.topWaiter.orders} órdenes</span>
              </div>
            </div>

            {/* ── Gráficas CSS ── */}
            <div className="charts-grid">
              {/* Ventas por hora */}
              <div className="chart-card">
                <h3 className="chart-title">Ventas por hora</h3>
                <BarChart
                  data={stats.byHour.map((h) => ({
                    hour: fmtHour(h.hour),
                    revenue: h.revenue,
                  }))}
                  valueKey="revenue"
                  labelKey="hour"
                  color="#818cf8"
                />
              </div>

              {/* Por categoría */}
              <div className="chart-card">
                <h3 className="chart-title">Ventas por categoría</h3>
                <PieList data={stats.byCategory} />
              </div>

              {/* Por modalidad */}
              <div className="chart-card">
                <h3 className="chart-title">Órdenes por modalidad</h3>
                <div className="source-list">
                  {stats.bySource.map((s, i) => (
                    <div key={s.source} className="source-row">
                      <div className="source-dot" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="source-name">
                        {s.source === 'autoservicio' ? 'Autoservicio' : s.source === 'waiter' ? 'Mesero' : s.source}
                      </span>
                      <span className="source-orders">{s.orders} órdenes</span>
                      <span className="source-revenue">{fmtMoney(s.revenue)}</span>
                    </div>
                  ))}
                  {stats.bySource.length === 0 && (
                    <p className="chart-empty">Sin datos para hoy</p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="admin-empty">No se pudieron cargar las métricas</div>
        )}
      </div>
    </AdminLayout>
  );
}