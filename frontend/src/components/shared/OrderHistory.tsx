// ============================================================
// frontend/src/components/shared/OrderHistory.tsx
//
// FIX IMPRESIÓN: Abre ventana nueva con HTML propio para imprimir
// en lugar de window.print() que imprimía el dashboard completo.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import '../../styles/orderhistory.css';

interface HistoryItem {
  name:     string;
  quantity: number;
  price:    number;
  subtotal: number;
}

interface HistoryOrder {
  id:             string;
  order_number:   string;
  status:         string;
  payment_method: string | null;
  payment_status: string;
  subtotal:       string;
  tax:            string;
  tip:            string;
  total:          string;
  source:         string;
  created_at:     string;
  completed_at:   string | null;
  table_number:   number | null;
  waiter_name:    string | null;
  cashier_name:   string | null;
  items:          HistoryItem[];
}

interface HistorySummary {
  totalOrders:   number;
  totalRevenue:  number;
  totalTips:     number;
  avgOrderValue: number;
}

interface HistoryResponse {
  date:    string;
  orders:  HistoryOrder[];
  summary: HistorySummary;
}

interface Props {
  onClose: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  autoservicio: ' Auto',
  waiter:       ' Mesero',
  kiosk:        ' Kiosk',
};

const METHOD_LABEL: Record<string, string> = {
  efectivo:        ' Efectivo',
  tarjeta_debito:  ' Débito',
  tarjeta_credito: ' Crédito',
  transferencia:   ' Transfer.',
  tarjeta:         ' Tarjeta',
};

// Genera el HTML completo para la ventana de impresión
function buildPrintHTML(data: HistoryResponse): string {
  const rows = data.orders.map((o) => {
    const itemsText = o.items.length > 0
      ? o.items.map((i) => `${i.quantity}× ${i.name} ($${parseFloat(String(i.subtotal)).toFixed(2)})`).join(', ')
      : '';

    return `
      <tr>
        <td>${o.order_number}</td>
        <td>${SOURCE_LABEL[o.source] ?? o.source}</td>
        <td>${o.table_number ? `Mesa ${o.table_number}` : '—'}${o.waiter_name ? ` · ${o.waiter_name}` : ''}</td>
        <td>${METHOD_LABEL[o.payment_method ?? ''] ?? o.payment_method ?? '—'}</td>
        <td>${new Date(o.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</td>
        <td style="text-align:right">$${parseFloat(o.total).toFixed(2)}</td>
        <td style="color:${o.status === 'completed' ? '#16a34a' : '#dc2626'}">${o.status === 'completed' ? 'Completado' : 'Cancelado'}</td>
      </tr>
      ${itemsText ? `<tr><td colspan="7" style="font-size:11px;color:#666;padding:3px 10px 8px;border-bottom:1px solid #eee">${itemsText}</td></tr>` : ''}
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Cierre de Caja — ${data.date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #000; padding: 24px; }
    h1 { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
    .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
    .summary {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 12px; margin-bottom: 24px;
    }
    .card { border: 1px solid #ddd; border-radius: 6px; padding: 12px; }
    .card .lbl { font-size: 11px; color: #777; margin-bottom: 4px; }
    .card .val { font-size: 20px; font-weight: bold; }
    .card.green { border-color: #22c55e; }
    .card.green .val { color: #16a34a; }
    table { width: 100%; border-collapse: collapse; }
    th {
      background: #f5f5f5; font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.4px;
      padding: 8px 10px; text-align: left;
      border-bottom: 2px solid #ccc;
    }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    .footer {
      margin-top: 20px; padding-top: 12px;
      border-top: 1px dashed #ccc;
      font-size: 11px; color: #888; text-align: center;
    }
    @media print {
      .summary { grid-template-columns: repeat(2,1fr); }
    }
  </style>
</head>
<body>
  <h1>RestaurantPWA — Cierre de Caja</h1>
  <p class="sub">Fecha: ${data.date} · Generado: ${new Date().toLocaleString('es')}</p>

  <div class="summary">
    <div class="card">
      <div class="lbl">Órdenes completadas</div>
      <div class="val">${data.summary.totalOrders}</div>
    </div>
    <div class="card green">
      <div class="lbl">Ingresos totales</div>
      <div class="val">$${data.summary.totalRevenue.toFixed(2)}</div>
    </div>
    <div class="card">
      <div class="lbl">Propinas</div>
      <div class="val">$${data.summary.totalTips.toFixed(2)}</div>
    </div>
    <div class="card">
      <div class="lbl">Ticket promedio</div>
      <div class="val">$${data.summary.avgOrderValue.toFixed(2)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Orden</th><th>Fuente</th><th>Mesa / Mesero</th>
        <th>Método</th><th>Hora</th>
        <th style="text-align:right">Total</th><th>Estado</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    Total registros: ${data.orders.length} · Ingresos: $${data.summary.totalRevenue.toFixed(2)}
  </div>

  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;
}

export default function OrderHistory({ onClose }: Props) {
  const [data,     setData]     = useState<HistoryResponse | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [date,     setDate]     = useState(
    new Date().toISOString().split('T')[0]
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<HistoryResponse>(`/orders/history?date=${date}`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Abre ventana nueva con HTML propio — no imprime el dashboard
  function handlePrint() {
    if (!data) return;
    const win = window.open('', '_blank', 'width=960,height=700,scrollbars=yes');
    if (!win) {
      alert('El navegador bloqueó la ventana emergente.\nPor favor permite ventanas emergentes para localhost y vuelve a intentarlo.');
      return;
    }
    win.document.write(buildPrintHTML(data));
    win.document.close();
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-title"
    >
      <div className="history-modal">
        {/* Header */}
        <div className="history-header">
          <div>
            <h2 className="history-title" id="history-title">Historial de pedidos</h2>
            <p className="history-sub">Cierre de caja del día</p>
          </div>
          <div className="history-header-actions">
            <input
              type="date"
              className="history-date-input"
              value={date}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Seleccionar fecha"
            />
            <button
              className="history-print-btn"
              onClick={handlePrint}
              disabled={!data || loading}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="2" y="5" width="11" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4 5V3a1 1 0 011-1h5a1 1 0 011 1v2M4 10h7"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Imprimir cierre
            </button>
            <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="history-body">
          {loading ? (
            <div className="history-loading">
              <div className="cashier-spinner" />
              <p>Cargando historial...</p>
            </div>
          ) : error ? (
            <div className="history-error" role="alert">
              <p>{error}</p>
              <button onClick={load}>Reintentar</button>
            </div>
          ) : data ? (
            <>
              {/* Resumen */}
              <div className="history-summary">
                <div className="hs-card">
                  <span className="hs-label">Órdenes completadas</span>
                  <span className="hs-value">{data.summary.totalOrders}</span>
                </div>
                <div className="hs-card hs-green">
                  <span className="hs-label">Ingresos totales</span>
                  <span className="hs-value">${data.summary.totalRevenue.toFixed(2)}</span>
                </div>
                <div className="hs-card">
                  <span className="hs-label">Propinas</span>
                  <span className="hs-value">${data.summary.totalTips.toFixed(2)}</span>
                </div>
                <div className="hs-card">
                  <span className="hs-label">Ticket promedio</span>
                  <span className="hs-value">${data.summary.avgOrderValue.toFixed(2)}</span>
                </div>
              </div>

              {/* Lista de órdenes */}
              {data.orders.length === 0 ? (
                <div className="history-empty">
                  <p>No hay pedidos para esta fecha</p>
                </div>
              ) : (
                <div className="history-orders">
                  <div className="ho-head">
                    <span>Orden</span>
                    <span>Fuente</span>
                    <span>Mesa / Mesero</span>
                    <span>Método</span>
                    <span>Hora</span>
                    <span className="col-right">Total</span>
                    <span>Estado</span>
                  </div>

                  {data.orders.map((order) => (
                    <div key={order.id} className="ho-row-wrap">
                      <div
                        className={`ho-row ${order.status === 'cancelled' ? 'ho-cancelled' : ''}`}
                        onClick={() => toggleExpand(order.id)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded.has(order.id)}
                        onKeyDown={(e) => e.key === 'Enter' && toggleExpand(order.id)}
                      >
                        <span className="ho-number">{order.order_number}</span>
                        <span className="ho-source">{SOURCE_LABEL[order.source] ?? order.source}</span>
                        <span className="ho-meta">
                          {order.table_number ? `Mesa ${order.table_number}` : '—'}
                          {order.waiter_name && <small> · {order.waiter_name}</small>}
                        </span>
                        <span className="ho-method">
                          {METHOD_LABEL[order.payment_method ?? ''] ?? order.payment_method ?? '—'}
                        </span>
                        <span className="ho-time">
                          {new Date(order.created_at).toLocaleTimeString('es', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        <span className="ho-total col-right">
                          ${parseFloat(order.total).toFixed(2)}
                        </span>
                        <span className={`ho-status ${order.status === 'completed' ? 'status-done' : 'status-cancel'}`}>
                          {order.status === 'completed' ? 'Completado' : 'Cancelado'}
                        </span>
                        <span className="ho-expand">
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                            style={{ transform: expanded.has(order.id) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path d="M2 4.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                        </span>
                      </div>

                      {expanded.has(order.id) && order.items.length > 0 && (
                        <div className="ho-items">
                          {order.items.map((item, i) => (
                            <div key={i} className="ho-item">
                              <span>{item.quantity}× {item.name}</span>
                              <span>${parseFloat(String(item.subtotal)).toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="ho-item-totals">
                            <div className="ho-item-total-row">
                              <span>Subtotal</span>
                              <span>${parseFloat(order.subtotal).toFixed(2)}</span>
                            </div>
                            {parseFloat(order.tip) > 0 && (
                              <div className="ho-item-total-row">
                                <span>Propina</span>
                                <span>${parseFloat(order.tip).toFixed(2)}</span>
                              </div>
                            )}
                            <div className="ho-item-total-row ho-grand">
                              <span>Total</span>
                              <span>${parseFloat(order.total).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}