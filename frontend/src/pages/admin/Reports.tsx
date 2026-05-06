// ============================================================
// frontend/src/pages/admin/Reports.tsx  →  /admin/reports
//
// FIX: recharts no está instalado.
// La gráfica de líneas se reemplaza con barras CSS nativas.
// Export Excel y PDF funcionan igual (sin dependencia de recharts).
// ============================================================

import { useState } from 'react';
import AdminLayout        from '../../components/admin/AdminLayout';
import { useAdminStore }  from '../../store/adminStore';
import { getReport }      from '../../services/adminService';
import type { ReportFilter, ReportData } from '../../types/admin';
import '../../styles/admin.css';
import { Printer, BarChart2 } from 'lucide-react';

const today = new Date().toISOString().split('T')[0];
const week  = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

const fmtMoney = (v: number) => `$${v.toFixed(2)}`;

// ── Gráfica de barras CSS nativa ─────────────────────────────
function DayBars({ data }: { data: ReportData['byDay'] }) {
  if (!data.length) return <p className="chart-empty">Sin datos en el período</p>;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="native-bar-chart">
      {data.map((d, i) => {
        const pct = (d.revenue / max) * 100;
        // Formato corto de fecha
        const label = new Date(d.date + 'T12:00:00').toLocaleDateString('es', {
          month: 'short', day: 'numeric',
        });
        return (
          <div key={i} className="nbc-row">
            <span className="nbc-label">{label}</span>
            <div className="nbc-track">
              <div
                className="nbc-fill"
                style={{ width: `${pct}%`, background: '#818cf8' }}
                title={`${d.orders} órdenes · ${fmtMoney(d.revenue)}`}
              />
            </div>
            <span className="nbc-value">{fmtMoney(d.revenue)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Reports() {
  const { report, reportLoading, setReport, setReportLoading, setError } = useAdminStore();

  const [filter, setFilter] = useState<ReportFilter>({
    from: week, to: today, source: 'all',
  });

  async function handleLoad() {
    setReportLoading(true);
    getReport(filter)
      .then(setReport)
      .catch((e: Error) => setError(e.message));
  }

  // Export Excel usando SheetJS (import dinámico)
  async function handleExportExcel() {
    if (!report) return;
    try {
      const XLSX = await import('xlsx');
      const wb   = XLSX.utils.book_new();

      // Resumen
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Reporte de Ventas', `${report.from} al ${report.to}`],
        [],
        ['Métrica', 'Valor'],
        ['Órdenes completadas', report.summary.totalOrders],
        ['Ingresos totales',    `$${report.summary.totalRevenue.toFixed(2)}`],
        ['Propinas',            `$${report.summary.totalTips.toFixed(2)}`],
        ['Ticket promedio',     `$${report.summary.avgTicket.toFixed(2)}`],
        ['Tasa de completación',`${report.summary.completionRate.toFixed(1)}%`],
      ]), 'Resumen');

      // Por día
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Fecha', 'Órdenes', 'Ingresos', 'Propinas'],
        ...report.byDay.map((d) => [d.date, d.orders, d.revenue, d.tips]),
      ]), 'Por día');

      // Top ítems
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Ítem', 'Categoría', 'Cantidad', 'Ingresos'],
        ...report.topItems.map((i) => [i.name, i.category, i.qty, i.revenue]),
      ]), 'Top ítems');

      // Meseros
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Mesero', 'Órdenes', 'Ingresos', 'Tiempo prom. (min)'],
        ...report.topWaiters.map((w) => [w.name, w.orders, w.revenue, w.avgTime ?? '—']),
      ]), 'Meseros');

      XLSX.writeFile(wb, `reporte_${report.from}_${report.to}.xlsx`);
    } catch {
      setError('Error al exportar Excel.');
    }
  }

  function handlePrint() {
    if (!report) return;
    const rows = report.byDay.map((d) =>
      `<tr><td>${d.date}</td><td>${d.orders}</td><td>$${d.revenue.toFixed(2)}</td><td>$${d.tips.toFixed(2)}</td></tr>`
    ).join('');
    const items = report.topItems.slice(0, 10).map((i, n) =>
      `<tr><td>${n + 1}</td><td>${i.name}</td><td>${i.category}</td><td>${i.qty}</td><td>$${i.revenue.toFixed(2)}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Reporte ${report.from} al ${report.to}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; font-size:13px; padding:24px; }
  h1 { font-size:18px; margin-bottom:4px; }
  .sub { color:#666; font-size:12px; margin-bottom:16px; }
  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:20px; }
  .kpi { border:1px solid #ddd; border-radius:6px; padding:10px; }
  .kpi .l { font-size:11px; color:#777; } .kpi .v { font-size:18px; font-weight:bold; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  th { background:#f5f5f5; font-size:11px; text-transform:uppercase; padding:7px 9px; text-align:left; border-bottom:2px solid #ccc; }
  td { padding:7px 9px; border-bottom:1px solid #eee; }
  h2 { font-size:14px; margin:16px 0 8px; }
</style></head><body>
<h1>Reporte de Ventas</h1>
<p class="sub">${report.from} al ${report.to} · Generado: ${new Date().toLocaleString('es')}</p>
<div class="kpis">
  <div class="kpi"><div class="l">Órdenes</div><div class="v">${report.summary.totalOrders}</div></div>
  <div class="kpi"><div class="l">Ingresos</div><div class="v">$${report.summary.totalRevenue.toFixed(2)}</div></div>
  <div class="kpi"><div class="l">Ticket prom.</div><div class="v">$${report.summary.avgTicket.toFixed(2)}</div></div>
  <div class="kpi"><div class="l">Completación</div><div class="v">${report.summary.completionRate.toFixed(1)}%</div></div>
</div>
<h2>Ventas por día</h2>
<table><thead><tr><th>Fecha</th><th>Órdenes</th><th>Ingresos</th><th>Propinas</th></tr></thead>
<tbody>${rows}</tbody></table>
<h2>Top ítems</h2>
<table><thead><tr><th>#</th><th>Ítem</th><th>Categoría</th><th>Uds.</th><th>Ingresos</th></tr></thead>
<tbody>${items}</tbody></table>
<script>window.onload=function(){window.print();};</script>
</body></html>`;

    const win = window.open('', '_blank', 'width=1000,height=700,scrollbars=yes');
    if (!win) { alert('Permite ventanas emergentes para localhost'); return; }
    win.document.write(html);
    win.document.close();
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Reportes</h1>
            <p className="admin-page-sub">Análisis de ventas y operaciones</p>
          </div>
          {report && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="admin-btn-ghost" onClick={handlePrint}><Printer size={14}/> PDF</button>
              <button className="admin-btn-ghost" onClick={handleExportExcel}><BarChart2 size={14}/> Excel</button>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="admin-filters report-filters">
          <div className="admin-field">
            <label>Desde</label>
            <input className="admin-input" type="date"
              value={filter.from} max={filter.to}
              onChange={(e) => setFilter({ ...filter, from: e.target.value })}/>
          </div>
          <div className="admin-field">
            <label>Hasta</label>
            <input className="admin-input" type="date"
              value={filter.to} min={filter.from} max={today}
              onChange={(e) => setFilter({ ...filter, to: e.target.value })}/>
          </div>
          <div className="admin-field">
            <label>Modalidad</label>
            <select className="admin-select" value={filter.source}
              onChange={(e) => setFilter({ ...filter, source: e.target.value as ReportFilter['source'] })}>
              <option value="all">Todas</option>
              <option value="autoservicio">Autoservicio</option>
              <option value="waiter">Mesero</option>
            </select>
          </div>
          <button className="admin-btn-primary" onClick={handleLoad} disabled={reportLoading}>
            {reportLoading ? 'Cargando...' : 'Generar reporte'}
          </button>
        </div>

        {reportLoading && (
          <div className="admin-loading"><div className="admin-spinner"/><p>Generando reporte...</p></div>
        )}

        {report && !reportLoading && (
          <>
            {/* KPIs */}
            <div className="kpi-grid">
              <div className="kpi-card kpi-primary">
                <span className="kpi-label">Órdenes completadas</span>
                <span className="kpi-value">{report.summary.totalOrders}</span>
              </div>
              <div className="kpi-card kpi-green">
                <span className="kpi-label">Ingresos totales</span>
                <span className="kpi-value">{fmtMoney(report.summary.totalRevenue)}</span>
                <span className="kpi-sub">Propinas: {fmtMoney(report.summary.totalTips)}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Ticket promedio</span>
                <span className="kpi-value">{fmtMoney(report.summary.avgTicket)}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Tasa de completación</span>
                <span className="kpi-value">{report.summary.completionRate.toFixed(1)}%</span>
              </div>
              {report.avgTimings.total && (
                <div className="kpi-card">
                  <span className="kpi-label">Tiempo prom. ciclo</span>
                  <span className="kpi-value">{report.avgTimings.total.toFixed(1)} min</span>
                  <span className="kpi-sub">Cocina: {report.avgTimings.preparation?.toFixed(1) ?? '—'} min</span>
                </div>
              )}
            </div>

            {/* Ventas por día */}
            <div className="chart-card">
              <h3 className="chart-title">Ventas por día</h3>
              <DayBars data={report.byDay} />
            </div>

            {/* Top items + Meseros */}
            <div className="reports-grid">
              <div className="admin-section">
                <h3 className="admin-section-title">Top 10 ítems</h3>
                <div className="admin-list">
                  {report.topItems.slice(0, 10).map((item, i) => (
                    <div key={item.name} className="admin-list-row">
                      <span className="rank-num">#{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="alr-name">{item.name}</p>
                        <p className="alr-sub">{item.category}</p>
                      </div>
                      <span className="alr-sub">{item.qty} uds.</span>
                      <span className="alr-price">{fmtMoney(item.revenue)}</span>
                    </div>
                  ))}
                  {report.topItems.length === 0 && <p className="admin-empty-msg">Sin datos</p>}
                </div>
              </div>

              <div className="admin-section">
                <h3 className="admin-section-title">Performance meseros</h3>
                <div className="admin-list">
                  {report.topWaiters.map((w, i) => (
                    <div key={w.name} className="admin-list-row">
                      <span className="rank-num">#{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <p className="alr-name">{w.name}</p>
                        <p className="alr-sub">{w.orders} órdenes</p>
                      </div>
                      <span className="alr-sub">
                        {w.avgTime != null ? `${w.avgTime.toFixed(1)} min` : '—'}
                      </span>
                      <span className="alr-price">{fmtMoney(w.revenue)}</span>
                    </div>
                  ))}
                  {report.topWaiters.length === 0 && (
                    <p className="admin-empty-msg">Sin órdenes de mesero</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {!report && !reportLoading && (
          <div className="admin-empty-state">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <rect x="8" y="8" width="40" height="40" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
              <path d="M18 36l7-8 6 6 9-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
            </svg>
            <p>Selecciona un período y genera el reporte</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}