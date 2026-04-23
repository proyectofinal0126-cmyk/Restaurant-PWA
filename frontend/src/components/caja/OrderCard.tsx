// ============================================================
// frontend/src/components/caja/OrderCard.tsx  —  Fase 4
//
// Tarjeta de orden con número, tiempo, estado, items y acciones.
// Las acciones disponibles cambian según el estado de la orden.
// ============================================================

import { useState } from 'react';
import type { OrderWithMeta } from '../../types/caja';
import type { OrderStatus } from '../../types/order';

interface Props {
  order:      OrderWithMeta;
  onValidate: (o: OrderWithMeta) => void;  // enviar a cocina
  onClose:    (o: OrderWithMeta) => void;  // cerrar pedido
  disabled?:  boolean;
}

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  pending_payment:    'Pago pendiente',
  payment_confirmed:  'Pago confirmado',
  pending_validation: 'Validando',
  sent_to_kitchen:    'En cocina',
  in_preparation:     'Preparando',
  ready_for_pickup:   'Listo ✓',
};

export default function OrderCard({ order, onValidate, onClose, disabled }: Props) {
  const [expanded, setExpanded] = useState(false);

  const isPending = ['pending_payment','payment_confirmed','pending_validation']
    .includes(order.status);
  const isReady   = order.status === 'ready_for_pickup';
  const isKitchen = ['sent_to_kitchen','in_preparation'].includes(order.status);

  const timeLabel = order.elapsedMinutes < 1   ? 'Ahora'
                  : order.elapsedMinutes === 1  ? '1 min'
                  : `${order.elapsedMinutes} min`;

  const accentColor = isReady ? '#22c55e'
    : order.isUrgent           ? '#ef4444'
    : isKitchen                ? '#f97316'
    : 'rgba(255,255,255,0.08)';

  return (
    <div
      className={`oc-card ${order.isUrgent ? 'oc-urgent' : ''} ${isReady ? 'oc-ready' : ''}`}
      style={{ '--accent': accentColor } as React.CSSProperties}
    >
      {/* Header */}
      <div className="oc-header">
        <div className="oc-left">
          <span className="oc-number">#{order.order_number}</span>
          <span className={`oc-badge ${isReady ? 'badge-green' : isKitchen ? 'badge-orange' : 'badge-gray'}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
        <div className="oc-right">
          <span className={`oc-time ${order.isUrgent ? 'time-red' : ''}`}>
            {order.isUrgent && '🔥 '}
            {timeLabel}
          </span>
          <button className="oc-expand-btn" onClick={() => setExpanded((v) => !v)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="oc-meta">
        <span className="oc-source">
          {order.source === 'autoservicio' ? '📱 Autoservicio' : '👤 Mesero'}
        </span>
        {order.payment_method && (
          <span className="oc-payment">
            {order.payment_method === 'efectivo' ? '💵' : order.payment_method === 'tarjeta' ? '💳' : '📲'}
            {' '}{order.payment_method}
          </span>
        )}
      </div>

      {/* Items (expandibles) */}
      {expanded && (
        <div className="oc-items">
          {order.items?.map((item) => (
            <div key={item.id} className="oc-item-row">
              <span className="oc-qty">{item.quantity}×</span>
              <span className="oc-name">{item.name}</span>
              <span className="oc-price">
                ${(parseFloat(item.price as unknown as string) * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
          {order.notes && (
            <div className="oc-order-notes">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
                <path d="M3 4h6M3 6.5h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              {order.notes}
            </div>
          )}
        </div>
      )}

      {/* Footer con total + acciones */}
      <div className="oc-footer">
        <span className="oc-total">
          ${parseFloat(order.total as unknown as string).toFixed(2)}
        </span>
        <div className="oc-actions">
          {isPending && (
            <button className="oc-btn btn-primary" onClick={() => onValidate(order)} disabled={disabled}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M1.5 6.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Enviar a cocina
            </button>
          )}
          {isReady && (
            <button className="oc-btn btn-success" onClick={() => onClose(order)} disabled={disabled}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M1.5 6.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Cerrar pedido
            </button>
          )}
          {isKitchen && (
            <span className="oc-monitoring">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M6.5 3.5v3l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Monitoreando
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
