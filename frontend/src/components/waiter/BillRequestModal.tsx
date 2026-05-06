// ============================================================
// frontend/src/components/waiter/BillRequestModal.tsx
//
// Modal que el mesero usa cuando el cliente pide la cuenta.
// Carga los detalles de la orden (items, subtotal, IVA) del
// backend al montarse, luego permite seleccionar método de pago
// y agregar propina antes de enviar a caja.
//
// FLUJO:
//   1. Mesero toca "Pedir cuenta" en la mesa entregada (delivered)
//   2. Este modal carga el detalle de la orden (GET /orders/:id)
//   3. Mesero elige método de pago y propina
//   4. Confirma → PATCH /orders/:id/request-bill
//   5. Mesa pasa a waiting_bill → CAJA cobra y libera la mesa
// ============================================================
import { Banknote, CreditCard, ArrowLeftRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { requestBill, getOrderDetail } from '../../services/waiterService';
import { ApiError }                    from '../../services/api';
import type { Order }                  from '../../types/order';

type PaymentMethod = 'efectivo' | 'tarjeta_debito' | 'tarjeta_credito' | 'transferencia';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'efectivo',        label: 'Efectivo',      icon: 'cash' },
  { value: 'tarjeta_debito',  label: 'Débito',        icon: 'card' },
  { value: 'tarjeta_credito', label: 'Crédito',       icon: '' },
  { value: 'transferencia',   label: 'Transf.',       icon: 'transfer' },
];

interface Props {
  orderId:     string;
  orderNumber: string;
  tableNumber: number;
  onSuccess:   () => void;
  onCancel:    () => void;
}

export default function BillRequestModal({
  orderId, orderNumber, tableNumber, onSuccess, onCancel,
}: Props) {
  const [order,      setOrder]      = useState<Order | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [method,     setMethod]     = useState<PaymentMethod>('efectivo');
  const [tipMode,    setTipMode]    = useState<'percent' | 'amount'>('percent');
  const [tipPercent, setTipPercent] = useState<number>(10);
  const [tipAmount,  setTipAmount]  = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    getOrderDetail(orderId)
      .then(setOrder)
      .catch(() => setError('No se pudo cargar el detalle de la orden'))
      .finally(() => setLoadingOrder(false));
  }, [orderId]);

  const subtotal  = parseFloat(String(order?.subtotal  ?? '0'));
  const tax       = parseFloat(String(order?.tax       ?? '0'));
  const baseTotal = parseFloat(String(order?.total     ?? '0'));

  const tipValue = tipMode === 'percent'
    ? parseFloat(((subtotal * tipPercent) / 100).toFixed(2))
    : parseFloat(tipAmount || '0');

  const finalTotal = baseTotal + tipValue;

  async function handleSend() {
    setSubmitting(true);
    setError(null);
    try {
      await requestBill(orderId, { payment_method: method, tip: tipValue });
      onSuccess();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Error al enviar la solicitud. Intenta de nuevo.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="brm-title"
    >
      <div className="brm-modal">

        {/* Header */}
        <div className="brm-header">
          <div className="brm-icon-wrap">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <rect x="3" y="5" width="20" height="16" rx="2" stroke="#f59e0b" strokeWidth="1.8"/>
              <path d="M3 10h20M8 15h4M16 15h2" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h2 className="brm-title" id="brm-title">Solicitar cuenta</h2>
            <p className="brm-sub">
              Orden <strong>{orderNumber}</strong> · Mesa {tableNumber}
            </p>
          </div>
          <button type="button" className="brm-close" onClick={onCancel} aria-label="Cerrar">×</button>
        </div>

        {loadingOrder ? (
          <div className="brm-loading">
            <div className="brm-spinner" />
            <p>Cargando detalle...</p>
          </div>
        ) : (
          <>
            {/* Items de la orden */}
            {order?.items && order.items.length > 0 && (
              <div className="brm-items">
                {order.items.map((item, i) => (
                  <div key={i} className="brm-item-row">
                    <span className="brm-item-qty">{item.quantity}×</span>
                    <span className="brm-item-name">{item.name}</span>
                    <span className="brm-item-price">
                      ${(parseFloat(String(item.price)) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Resumen */}
            <div className="brm-summary">
              <div className="brm-sum-row">
                <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="brm-sum-row">
                <span>IVA (8%)</span><span>${tax.toFixed(2)}</span>
              </div>
            </div>

            {/* Método de pago */}
            <div className="brm-section">
              <p className="brm-section-label">Método de pago</p>
              <div className="brm-payment-grid">
                {PAYMENT_OPTIONS.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    className={`brm-pay-btn ${method === value ? 'brm-pay-btn--active' : ''}`}
                    onClick={() => setMethod(value)}
                  >
                    <span className="brm-pay-icon">
  {icon === 'cash' ? <Banknote size={16}/> : icon === 'card' ? <CreditCard size={16}/> : <ArrowLeftRight size={16}/>}
</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Propina */}
            <div className="brm-section">
              <div className="brm-tip-header">
                <p className="brm-section-label">Propina</p>
                <div className="brm-tip-mode">
                  <button
                    type="button"
                    className={`brm-mode-btn ${tipMode === 'percent' ? 'active' : ''}`}
                    onClick={() => setTipMode('percent')}
                  >%</button>
                  <button
                    type="button"
                    className={`brm-mode-btn ${tipMode === 'amount' ? 'active' : ''}`}
                    onClick={() => setTipMode('amount')}
                  >$</button>
                </div>
              </div>

              {tipMode === 'percent' ? (
                <div className="brm-tip-percents">
                  {[0, 5, 10, 15, 20].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`brm-tip-chip ${tipPercent === p ? 'brm-tip-chip--active' : ''}`}
                      onClick={() => setTipPercent(p)}
                    >
                      {p === 0 ? 'Sin propina' : `${p}%`}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="brm-tip-amount-wrap">
                  <span className="brm-tip-currency">$</span>
                  <input
                    type="number"
                    className="brm-tip-input"
                    placeholder="0.00"
                    min="0"
                    step="0.50"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                  />
                </div>
              )}

              {tipValue > 0 && (
                <p className="brm-tip-preview">
                  Propina: <strong>${tipValue.toFixed(2)}</strong>
                </p>
              )}
            </div>

            {/* Total final */}
            <div className="brm-total-box">
              <span className="brm-total-label">Total a cobrar</span>
              <span className="brm-total-value">${finalTotal.toFixed(2)}</span>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="brm-error" role="alert">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7 4.5v3M7 9v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        {/* Acciones */}
        {!loadingOrder && (
          <div className="brm-actions">
            <button type="button" className="brm-btn-cancel" onClick={onCancel} disabled={submitting}>
              Cancelar
            </button>
            <button
              type="button"
              className="brm-btn-send"
              onClick={handleSend}
              disabled={submitting}
              autoFocus
            >
              {submitting ? (
                <span className="btn-spinner" aria-hidden="true" />
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 7h6M5 9.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Enviar a caja
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
