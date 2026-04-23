// ============================================================
// frontend/src/components/cashier/PaymentMethod.tsx  —  Fase 7
//
// Propósito: Modal de selección y confirmación de pago.
//   Maneja: efectivo (con cambio), tarjeta débito/crédito,
//   transferencia. Permite agregar propina y referencia.
//
// Ruta: frontend/src/components/cashier/PaymentMethod.tsx
//
// Props:
//   interface Props {
//     onSuccess: (result: PayOrderResponse) => void;
//     onBack:    () => void;  // vuelve a BillGenerator
//     onClose:   () => void;
//   }
//
// Flujo de datos:
//   1. Lee activeBill y selectedTable del cashierStore
//   2. Usuario elige método, ingresa monto y propina opcional
//   3. Validación frontend: amountPaid >= total + tip
//   4. POST /cashier/orders/:id/pay → PayOrderResponse
//   5. Guarda result en cashierStore.paymentResult
//   6. onSuccess(result) → abre TableRelease
//
// Seguridad: El backend revalida amountPaid >= total.
//   isProcessing bloquea reenvíos mientras espera respuesta.
// ============================================================

import { useState, useEffect } from 'react';
import { useCashierStore }     from '../../store/cashierStore';
import { payOrder }            from '../../services/cashierService';
import { ApiError }            from '../../services/api';
import type { CashierPaymentMethod } from '../../types/cashier';
import type { PayOrderResponse }     from '../../types/cashier';

interface Props {
  onSuccess: (result: PayOrderResponse) => void;
  onBack:    () => void;
  onClose:   () => void;
}

const METHOD_OPTIONS: { value: CashierPaymentMethod; label: string; icon: string }[] = [
  { value: 'efectivo',        label: 'Efectivo',        icon: '💵' },
  { value: 'tarjeta_debito',  label: 'Tarjeta débito',  icon: '💳' },
  { value: 'tarjeta_credito', label: 'Tarjeta crédito', icon: '💳' },
  { value: 'transferencia',   label: 'Transferencia',   icon: '📲' },
];

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

  const [amountPaid, setAmountPaid] = useState('');
  const [tip,        setTip]        = useState('');
  const [reference,  setReference]  = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!activeBill || !selectedTable) return null;

  const totalWithTip = activeBill.total + (parseFloat(tip) || 0);
  const isCash       = paymentMethod === 'efectivo';
  const paid         = parseFloat(amountPaid) || 0;
  const change       = isCash ? Math.max(0, paid - totalWithTip) : 0;

  // Para métodos que no son efectivo, el monto es el total automáticamente
  useEffect(() => {
    if (!isCash) setAmountPaid(totalWithTip.toFixed(2));
  }, [paymentMethod, totalWithTip, isCash]);

  // Validación local
  function validate(): string | null {
    if (isCash && paid < totalWithTip) {
      return `El monto recibido ($${paid.toFixed(2)}) es menor al total ($${totalWithTip.toFixed(2)})`;
    }
    if (!isCash && paid <= 0) {
      return 'El monto es inválido';
    }
    return null;
  }

  async function handleConfirm() {
    if (!activeBill || !selectedTable) return;
    const validationError = validate();
    if (validationError) { setSubmitError(validationError); return; }

    setSubmitError(null);
    setProcessing(true);

    try {
      const result = await payOrder(activeBill.orderId, {
        method:     paymentMethod,
        amountPaid: paid,
        tip:        parseFloat(tip) || 0,
        reference:  reference.trim() || undefined,
      });
      setPaymentResult(result);
      onSuccess(result);
    } catch (e) {
      setSubmitError(
        e instanceof ApiError
          ? e.message
          : 'Error al procesar el pago. Intenta de nuevo.'
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
          {/* Resumen del total */}
          <div className="payment-total-banner">
            <span className="ptb-label">Total a cobrar</span>
            <span className="ptb-amount">${totalWithTip.toFixed(2)}</span>
          </div>

          {/* Método de pago */}
          <div className="payment-methods">
            {METHOD_OPTIONS.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                className={`pm-option ${paymentMethod === value ? 'pm-option--active' : ''}`}
                onClick={() => { setPaymentMethod(value); setSubmitError(null); }}
                disabled={isProcessing}
              >
                <span className="pm-icon">{icon}</span>
                <span className="pm-label">{label}</span>
              </button>
            ))}
          </div>

          {/* Propina */}
          <div className="payment-field">
            <label className="pf-label" htmlFor="tip-input">
              Propina (opcional)
              <span className="pf-hint">Sugerida: ${activeBill.suggestedTip.toFixed(2)}</span>
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
                value={tip}
                onChange={(e) => { setTip(e.target.value); setSubmitError(null); }}
                disabled={isProcessing}
              />
            </div>
            {/* Atajo propina sugerida */}
            <button
              type="button"
              className="tip-shortcut"
              onClick={() => setTip(activeBill.suggestedTip.toFixed(2))}
              disabled={isProcessing}
            >
              + Agregar ${activeBill.suggestedTip.toFixed(2)} (10%)
            </button>
          </div>

          {/* Monto recibido — solo efectivo */}
          {isCash && (
            <div className="payment-field">
              <label className="pf-label" htmlFor="amount-input">
                Monto recibido
              </label>
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
              {/* Cambio calculado en tiempo real */}
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
          <button
            type="button"
            className="pm-btn-secondary"
            onClick={onBack}
            disabled={isProcessing}
          >
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