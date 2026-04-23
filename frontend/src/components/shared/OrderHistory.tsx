// ============================================================
// frontend/src/components/shared/OrderHistory.tsx  —  Fix 4
//
// Propósito: Panel de historial de pedidos del día.
//   Accesible desde Caja Autoservicio y Caja Con Mesero.
//   Solo visible para el rol 'caja' y 'admin'.
//
// Muestra:
//   - Resumen del día (total órdenes, ingresos, propinas)
//   - Lista de órdenes completadas/canceladas del día
//   - Desglose por item de cada orden (expandible)
//   - Opción de imprimir cierre de caja
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';

interface HistoryItem {
  name:     string;
  quantity: number;
  price:    number;
  subtotal: number;
}

interface HistoryOrder {
  id:              string;
  order_number:    string;
  status:          string;
  payment_method:  string | null;
  payment_status:  string;
  subtotal:        string;
  tax:             string;
  tip:             string;
  total:           string;
  source:          string;
  created_at:      string;
  completed_at:    string | null;
  table_number:    number | null;
  waiter_name:     string | null;
  cashier_name:    string | null;
  items:           HistoryItem[];
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

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const SOURCE_LABEL: Record<string, string> = {
  autoservicio: '📱 Auto',
  waiter:       '👤 Mesero',
  kiosk:        '🖥️ Kiosk',
};

const METHOD_LABEL: Record<string, string> = {
  efectivo:        '💵 Efectivo',
  tarjeta_debito:  '💳 Débito',
  tarjeta_credito: '💳 Crédito',
  transferencia:   '📲 Transfer.',
  tarjeta:         '💳 Tarjeta',
};

export default function OrderHistory({ onClose }: Props) {
  const [data,      setData]      = useState<HistoryResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());
  const [date,      setDate]      = useState(
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

  function handlePrint() {
    window.print();
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
        <div className="history-header no-print">
          <div>
            <h2 className="history-title" id="history-title">
              Historial de pedidos
            </h2>
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
            <button className="history-print-btn" onClick={handlePrint}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="2" y="5" width="11" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4 5V3a1 1 0 011-1h5a1 1 0 011 1v2M4 10h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Imprimir cierre
            </button>
            <button className="modal-close-btn" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Print header */}
        <div className="print-only history-print-header">
          <h1>RestaurantPWA — Cierre de Caja</h1>
          <p>Fecha: {date} · Generado: {new Date().toLocaleString('es')}</p>
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
              {/* Resumen del día */}
              <div className="history-summary" id="history-summary">
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
                  {/* Cabecera de tabla */}
                  <div className="ho-head no-print">
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
                        aria-expanded={expanded.has(order.id)}
                        tabIndex={0}
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
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        <span className="ho-total col-right">${parseFloat(order.total).toFixed(2)}</span>
                        <span className={`ho-status ${order.status === 'completed' ? 'status-done' : 'status-cancel'}`}>
                          {STATUS_LABEL[order.status] ?? order.status}
                        </span>
                        <span className="ho-expand no-print">
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                            style={{ transform: expanded.has(order.id) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path d="M2 4.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                        </span>
                      </div>

                      {/* Items expandibles */}
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