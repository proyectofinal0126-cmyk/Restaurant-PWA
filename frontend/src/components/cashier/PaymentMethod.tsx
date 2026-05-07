// ============================================================
// frontend/src/components/cashier/PaymentMethod.tsx  —  Fase 7
//
// REGLA CLAVE — propina y método cuando vienen del mesero:
//
//   El backend (request-bill) ya sumó la propina al total y la
//   guardó en la BD:
//       orders.total    = subtotal + tax + tip   ← YA incluye propina
//       orders.tip      = 5.00
//       activeBill.total = 11.48  (NO sumar otra vez)
//
//   Por eso distinguimos dos modos:
//
//   A) "Cerrado" (waiterLocked = true):
//      - El mesero ya negoció método y propina con el cliente.
//      - activeBill.tip > 0  →  propina fija, campo readonly.
//      - selectedTable.paymentMethod set  →  método fijo, sin grilla.
//      - totalWithTip = activeBill.total  (propina ya incluida, no sumar)
//      - No se envía tip extra al backend (ya está en la orden).
//
//   B) "Abierto" (waiterLocked = false):
//      - Flujo autoservicio o mesero sin propina/método previo.
//      - Caja elige método y puede agregar propina libremente.
//      - totalWithTip = activeBill.total + tipEditable
//      - Se envía tip al backend.
// ============================================================

import { useState, useEffect } from 'react';
import { useCashierStore }     from '../../store/cashierStore';
import { payOrder }            from '../../services/cashierService';
import { ApiError }            from '../../services/api';
import type { CashierPaymentMethod } from '../../types/cashier';
import type { PayOrderResponse }     from '../../types/cashier';
import { Banknote, CreditCard, ArrowLeftRight } from 'lucide-react';
interface Props {
  onSuccess: (result: PayOrderResponse) => void;
  onBack:    () => void;
  onClose:   () => void;
}

const METHOD_OPTIONS: { value: CashierPaymentMethod; label: string; icon: string }[] = [
  { value: 'efectivo',        label: 'Efectivo',        icon: 'cash' },
  { value: 'tarjeta_debito',  label: 'Tarjeta débito',  icon: 'card' },
  { value: 'tarjeta_credito', label: 'Tarjeta crédito', icon: 'card' },
  { value: 'transferencia',   label: 'Transferencia',   icon: 'transfer' },
];

const METHOD_LABELS: Record<string, string> = {
  efectivo:        'Efectivo',
  tarjeta_debito:  'Tarjeta débito',
  tarjeta_credito: 'Tarjeta crédito',
  transferencia:   'Transferencia',
};

export default function PaymentMethod({ onSuccess, onBack, onClose }: Props) {
  const {
    activeBill,
    selectedTable,
    paymentMethod,
    setPaymentMethod,
    setPaymentResult,
    isProcessing,
    setProcessing,
  } = useCashierStore();

  // ── ¿Mesero ya definió propina / método? ──────────────────
  // activeBill.tip > 0  →  propina ya incluida en activeBill.total, no sumar otra vez.
  // selectedTable.paymentMethod set  →  método acordado, no editable.
const waiterTip            = activeBill?.tip ?? 0;
const methodLockedByWaiter = !!selectedTable?.paymentMethod;
const tipLockedByWaiter    = methodLockedByWaiter;

  // Propina libre (solo cuando el mesero NO la fijó)
  const [tipEditable, setTipEditable] = useState('');

  const [amountPaid,  setAmountPaid]  = useState('');
  const [reference,   setReference]   = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!activeBill || !selectedTable) return null;

  // ── Total ─────────────────────────────────────────────────
  // Si el mesero ya incluyó propina en la orden, activeBill.total ya la lleva.
  // Solo sumamos propina adicional cuando Caja la agrega manualmente.
  const extraTip     = tipLockedByWaiter ? 0 : (parseFloat(tipEditable) || 0);
  const totalWithTip = activeBill.total + extraTip;

  const isCash = paymentMethod === 'efectivo';
  const paid   = parseFloat(amountPaid) || 0;
  const change = isCash ? Math.max(0, paid - totalWithTip) : 0;

  // Auto-rellenar monto para métodos no-efectivo
  useEffect(() => {
    if (!isCash) setAmountPaid(totalWithTip.toFixed(2));
  }, [paymentMethod, totalWithTip, isCash]);

  function validate(): string | null {
    if (isCash && paid < totalWithTip)
      return `El monto recibido ($${paid.toFixed(2)}) es menor al total ($${totalWithTip.toFixed(2)})`;
    if (!isCash && paid <= 0)
      return 'El monto es inválido';
    return null;
  }

  async function handleConfirm() {
    if (!activeBill || !selectedTable) return;
    const err = validate();
    if (err) { setSubmitError(err); return; }

    setSubmitError(null);
    setProcessing(true);

    try {
      // Si la propina ya está en la orden (tipLockedByWaiter), enviamos 0
      // para que el backend no la sume de nuevo.
      const result = await payOrder(activeBill.orderId, {
        method:     paymentMethod,
        amountPaid: paid,
        tip:        tipLockedByWaiter ? 0 : extraTip,
        reference:  reference.trim() || undefined,
      });
      setPaymentResult(result);
      onSuccess(result);
    } catch (e) {
      setSubmitError(
        e instanceof ApiError ? e.message : 'Error al procesar el pago. Intenta de nuevo.'
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-title"
    >
      <div className="payment-modal">

        {/* Header */}
        <div className="payment-header">
          <button className="modal-back-btn" onClick={onBack} aria-label="Volver a la cuenta">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <div>
            <h2 className="payment-title" id="payment-title">Método de pago</h2>
            <p className="payment-sub">Mesa {selectedTable.tableNumber} · {activeBill.orderNumber}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="payment-body">

          {/* Total */}
          <div className="payment-total-banner">
            <span className="ptb-label">Total a cobrar</span>
            <span className="ptb-amount">${totalWithTip.toFixed(2)}</span>
          </div>

          {/* ── Método de pago ───────────────────────────────── */}
          {methodLockedByWaiter ? (
            <div className="payment-field">
              <p className="pf-label">
                Método de pago
                <span className="pf-hint pf-hint--locked"> — acordado con el cliente</span>
              </p>
              <div className="pm-locked-badge">
                {METHOD_LABELS[selectedTable.paymentMethod ?? ''] ?? selectedTable.paymentMethod}
                <span className="pm-locked-icon" title="Fijado por el mesero">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="2" y="5.5" width="9" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.1"/>
                    <path d="M4 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                  </svg>
                </span>
              </div>
            </div>
          ) : (
            <div className="payment-methods">
              {METHOD_OPTIONS.map(({ value, label, icon }) => (
                <button
                  key={value}
                  type="button"
                  className={`pm-option ${paymentMethod === value ? 'pm-option--active' : ''}`}
                  onClick={() => { setPaymentMethod(value); setSubmitError(null); }}
                  disabled={isProcessing}
                >
                  <span className="pm-icon">
  {icon === 'cash' ? <Banknote size={18}/> : icon === 'card' ? <CreditCard size={18}/> : <ArrowLeftRight size={18}/>}
</span>
                  <span className="pm-label">{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Propina ──────────────────────────────────────── */}
          {tipLockedByWaiter ? (
            <div className="payment-field">
              <p className="pf-label">
                Propina
                <span className="pf-hint pf-hint--locked"> — acordada con el cliente</span>
              </p>
              <div className="pm-locked-badge">
                ${waiterTip.toFixed(2)}
                <span className="pm-locked-icon" title="Fijada por el mesero">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="2" y="5.5" width="9" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.1"/>
                    <path d="M4 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                  </svg>
                </span>
              </div>
            </div>
          ) : (
            <div className="payment-field">
              <label className="pf-label" htmlFor="tip-input">
                Propina <span className="pf-hint">— opcional</span>
              </label>
              <div className="pf-input-wrap">
                <span className="pf-currency">$</span>
                <input
                  id="tip-input"
                  type="number"
                  min="0"
                  step="0.50"
                  className="pf-input"
                  placeholder="0.00"
                  value={tipEditable}
                  onChange={(e) => { setTipEditable(e.target.value); setSubmitError(null); }}
                  disabled={isProcessing}
                />
              </div>
              {activeBill.suggestedTip > 0 && (
                <button
                  type="button"
                  className="tip-shortcut"
                  onClick={() => setTipEditable(activeBill.suggestedTip.toFixed(2))}
                  disabled={isProcessing}
                >
                  + Agregar ${activeBill.suggestedTip.toFixed(2)} (10%)
                </button>
              )}
            </div>
          )}

          {/* Monto recibido — solo efectivo */}
          {isCash && (
            <div className="payment-field">
              <label className="pf-label" htmlFor="amount-input">Monto recibido</label>
              <div className="pf-input-wrap">
                <span className="pf-currency">$</span>
                <input
                  id="amount-input"
                  type="number"
                  min={totalWithTip}
                  step="0.01"
                  className={`pf-input pf-input-lg ${submitError ? 'pf-input--error' : ''}`}
                  placeholder={totalWithTip.toFixed(2)}
                  value={amountPaid}
                  onChange={(e) => { setAmountPaid(e.target.value); setSubmitError(null); }}
                  autoFocus
                  disabled={isProcessing}
                />
              </div>
              {paid > 0 && paid >= totalWithTip && (
                <div className="change-display">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3 3 7-7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Cambio: <strong>${change.toFixed(2)}</strong>
                </div>
              )}
            </div>
          )}

          {/* Referencia — tarjeta / transferencia */}
          {!isCash && (
            <div className="payment-field">
              <label className="pf-label" htmlFor="ref-input">
                Referencia <span className="pf-hint">— opcional</span>
              </label>
              <input
                id="ref-input"
                type="text"
                className="pf-input-text"
                placeholder="Nº de autorización o comprobante"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={isProcessing}
                maxLength={100}
              />
            </div>
          )}

          {/* Error */}
          {submitError && (
            <div className="payment-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M7 4.5v3M7 9v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="payment-footer">
          <button type="button" className="pm-btn-secondary" onClick={onBack} disabled={isProcessing}>
            Ver cuenta
          </button>
          <button
            type="button"
            className="pm-btn-confirm"
            onClick={handleConfirm}
            disabled={isProcessing || (isCash && paid < totalWithTip)}
          >
            {isProcessing ? (
              <><span className="btn-spinner" aria-hidden="true" /> Procesando...</>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2.5 8l4 4 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Confirmar pago
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
