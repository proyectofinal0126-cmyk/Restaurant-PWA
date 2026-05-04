// ============================================================
// frontend/src/components/waiter/OrderDetailModal.tsx
//
// Modal que muestra el detalle completo de una orden activa
// en una mesa. El mesero lo abre desde la tarjeta de mesa
// para ver qué se pidió, cantidades, totales y estado.
// ============================================================

import { useEffect, useState } from 'react';
import { getOrderDetail }       from '../../services/waiterService';
import { formatCOP }            from '../../utils/constants';
import type { Order }           from '../../types/order';

interface Props {
  orderId:     string;
  orderNumber: string;
  tableNumber: number;
  onClose:     () => void;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:              { label: 'Pendiente',       color: '#f59e0b' },
  pending_payment:      { label: 'Pend. pago',      color: '#f59e0b' },
  payment_confirmed:    { label: 'Pago confirmado', color: '#10b981' },
  pending_validation:   { label: 'En validación',   color: '#8b5cf6' },
  sent_to_kitchen:      { label: 'En cocina',       color: '#3b82f6' },
  in_preparation:       { label: 'Preparando',      color: '#f97316' },
  ready_for_pickup:     { label: '¡Listo!',         color: '#10b981' },
  delivered:            { label: 'Entregado',       color: '#6b7280' },
  completed:            { label: 'Completado',      color: '#6b7280' },
  cancelled:            { label: 'Cancelado',       color: '#ef4444' },
};

export default function OrderDetailModal({ orderId, orderNumber, tableNumber, onClose }: Props) {
  const [order,   setOrder]   = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getOrderDetail(orderId)
      .then(setOrder)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  const statusInfo = order ? (STATUS_LABEL[order.status] ?? { label: order.status, color: '#6b7280' }) : null;

  return (
    <div className="odm-overlay" role="dialog" aria-modal="true" aria-label={`Detalle orden ${orderNumber}`}>
      <div className="odm-panel">

        {/* Cabecera */}
        <div className="odm-header">
          <div className="odm-title-group">
            <span className="odm-table-badge">Mesa {tableNumber}</span>
            <h2 className="odm-title">{orderNumber}</h2>
          </div>
          {statusInfo && (
            <span className="odm-status-chip" style={{ background: `${statusInfo.color}18`, color: statusInfo.color, borderColor: `${statusInfo.color}30` }}>
              {statusInfo.label}
            </span>
          )}
          <button type="button" className="odm-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Contenido */}
        <div className="odm-body">
          {loading && (
            <div className="odm-loading">
              <div className="odm-spinner" />
              <span>Cargando pedido…</span>
            </div>
          )}

          {error && (
            <div className="odm-error">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M10 6v5M10 13v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {order && !loading && (
            <>
              {/* Items del pedido */}
              <div className="odm-section">
                <h3 className="odm-section-title">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M4 7h6M4 9.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Artículos pedidos
                </h3>

                {order.items && order.items.length > 0 ? (
                  <ul className="odm-items-list">
                    {order.items.map((item, idx) => (
                      <li key={item.id ?? idx} className="odm-item">
                        <div className="odm-item-main">
                          <span className="odm-item-qty">{item.quantity}×</span>
                          <div className="odm-item-info">
                            <span className="odm-item-name">{item.name}</span>
                            {item.special_instructions && (
                              <span className="odm-item-note">📝 {item.special_instructions}</span>
                            )}
                          </div>
                        </div>
                        <span className="odm-item-price">
                          {formatCOP(parseFloat(String(item.price)) * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="odm-empty-items">Sin artículos registrados</p>
                )}
              </div>

              {/* Notas de la orden */}
              {order.notes && (
                <div className="odm-section">
                  <h3 className="odm-section-title">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 3h10M2 6h8M2 9h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    Notas
                  </h3>
                  <p className="odm-notes">{order.notes}</p>
                </div>
              )}

              {/* Totales */}
              <div className="odm-totals">
                <div className="odm-total-row">
                  <span>Subtotal</span>
                  <span>{formatCOP(parseFloat(String(order.subtotal ?? 0)))}</span>
                </div>
                {parseFloat(String(order.tax ?? 0)) > 0 && (
                  <div className="odm-total-row">
                    <span>IVA</span>
                    <span>{formatCOP(parseFloat(String(order.tax)))}</span>
                  </div>
                )}
                {parseFloat(String(order.tip ?? 0)) > 0 && (
                  <div className="odm-total-row">
                    <span>Propina</span>
                    <span>{formatCOP(parseFloat(String(order.tip)))}</span>
                  </div>
                )}
                <div className="odm-total-row odm-total-final">
                  <span>Total</span>
                  <span>{formatCOP(parseFloat(String(order.total ?? 0)))}</span>
                </div>
              </div>

              {/* Método de pago si ya se definió */}
              {order.payment_method && (
                <div className="odm-payment">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="3.5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M1 6.5h12" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                  <span>{order.payment_method}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="odm-footer">
          <button type="button" className="odm-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
