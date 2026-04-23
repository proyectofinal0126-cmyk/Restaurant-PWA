// ============================================================
// frontend/src/components/caja/PaymentProcessor.tsx  —  Fase 4
//
// Modal que confirma el método de pago y valida la orden.
// Calcula cambio para pagos en efectivo.
// Al confirmar → PATCH /api/orders/:id/status → sent_to_kitchen
// ============================================================

import { useState } from 'react';
import type { OrderWithMeta } from '../../types/caja';

interface Props {
  order:     OrderWithMeta;
  onConfirm: (orderId: string) => Promise<void>;
  onCancel:  () => void;
  loading:   boolean;
}

export default function PaymentProcessor({ order, onConfirm, onCancel, loading }: Props) {
  const total          = parseFloat(order.total as unknown as string);
  const [monto, setMonto] = useState('');
  const montoParsed    = parseFloat(monto) || 0;
  const cambio         = montoParsed > total ? montoParsed - total : 0;
  const esEfectivo     = order.payment_method === 'efectivo';

  const canConfirm = !esEfectivo || montoParsed >= total;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="pp-modal">
        <div className="pp-header">
          <h2 className="pp-title">Procesar pago</h2>
          <button className="pp-close" onClick={onCancel}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Resumen */}
        <div className="pp-summary">
          <div className="pp-row">
            <span>Orden</span>
            <span className="pp-val">#{order.order_number}</span>
          </div>
          <div className="pp-row">
            <span>Método</span>
            <span className="pp-val pp-payment-badge">
              {order.payment_method === 'efectivo' ? '💵 Efectivo'
               : order.payment_method === 'tarjeta' ? '💳 Tarjeta'
               : '📲 Transferencia'}
            </span>
          </div>
          <div className="pp-divider" />
          <div className="pp-row pp-total-row">
            <span>Total a cobrar</span>
            <span className="pp-total">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Monto recibido (solo efectivo) */}
        {esEfectivo && (
          <div className="pp-cash-section">
            <label className="pp-label" htmlFor="pp-monto">Monto recibido</label>
            <div className="pp-input-wrap">
              <span className="pp-currency">$</span>
              <input
                id="pp-monto"
                type="number"
                min={total}
                step="0.01"
                className="pp-input"
                placeholder={total.toFixed(2)}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                autoFocus
              />
            </div>
            {cambio > 0 && (
              <div className="pp-change">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3 3 7-7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Cambio: <strong>${cambio.toFixed(2)}</strong>
              </div>
            )}
          </div>
        )}

        <div className="pp-actions">
          <button className="pp-btn-cancel" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button
            className="pp-btn-confirm"
            onClick={() => onConfirm(order.id)}
            disabled={loading || !canConfirm}
          >
            {loading ? <span className="btn-spinner" /> : (
              <>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M2 7.5l3.5 3.5 7.5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Confirmar y enviar a cocina
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
