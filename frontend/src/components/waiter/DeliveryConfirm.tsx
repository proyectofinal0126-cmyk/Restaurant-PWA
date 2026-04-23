// ============================================================
// frontend/src/components/waiter/DeliveryConfirm.tsx  —  Fase 6
//
// Modal que el mesero usa para confirmar la entrega física
// del pedido a la mesa.
//
// FLUJO:
//   1. Pedido llega a ready_for_pickup (cocina lo marcó listo)
//   2. Mesero ve el badge "¡Listo!" en la mesa
//   3. Abre este modal → confirma que llevó el pedido
//   4. PATCH /api/orders/:id/status → status: 'delivered'
//   5. Backend actualiza delivered_at + emite WS order:status
//   6. Mesa queda en status 'occupied' (hasta que caja la cierra)
//   7. onSuccess() → refresca el dashboard de mesas
// ============================================================

import { useState } from 'react';
import { markAsDelivered } from '../../services/waiterService';
import { ApiError }        from '../../services/api';

interface Props {
  orderId:     string;
  orderNumber: string;
  tableNumber: number;
  onSuccess:   () => void;
  onCancel:    () => void;
}

export default function DeliveryConfirm({
  orderId,
  orderNumber,
  tableNumber,
  onSuccess,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await markAsDelivered(orderId);
      onSuccess();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Error al confirmar la entrega. Intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dc-title"
    >
      <div className="dc-modal">
        {/* Header */}
        <div className="dc-header">
          <div className="dc-icon-wrap">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M4 14l6 6 14-14" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h2 className="dc-title" id="dc-title">Confirmar entrega</h2>
            <p className="dc-sub">Orden <strong>{orderNumber}</strong> — Mesa {tableNumber}</p>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="dc-body">
          <p className="dc-message">
            ¿Confirmás que llevaste el pedido a la mesa <strong>{tableNumber}</strong>?
          </p>
          <div className="dc-info-row">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M8 5v3.5L10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Se registrará la hora de entrega
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="dc-error" role="alert">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7 4.5v3M7 9v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        {/* Acciones */}
        <div className="dc-actions">
          <button
            type="button"
            className="dc-btn-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="dc-btn-confirm"
            onClick={handleConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? (
              <span className="btn-spinner" aria-hidden="true" />
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2.5 8l4 4 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Sí, entregué el pedido
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}