// ============================================================
// frontend/src/components/cashier/TableRelease.tsx  —  Fase 7
//
// Propósito: Modal de confirmación de cierre de mesa.
//   Muestra el resumen final del pago y permite liberar la mesa
//   (PATCH /cashier/tables/:id/release) y generar el comprobante.
//
// Ruta: frontend/src/components/cashier/TableRelease.tsx
//
// Props:
//   interface Props {
//     onReleased: () => void;  // mesa liberada — vuelve al dashboard
//     onClose:    () => void;
//   }
//
// Flujo de datos:
//   1. Lee paymentResult y selectedTable del cashierStore
//   2. Usuario confirma → PATCH /cashier/tables/:id/release
//   3. Backend: table.status = 'available', emite WS table:released
//   4. resetFlow() limpia el store
//   5. onReleased() → cierra modales y recarga dashboard
// ============================================================

import { useState, useRef } from 'react';
import { useCashierStore }   from '../../store/cashierStore';
import { releaseTable }      from '../../services/cashierService';
import { ApiError }          from '../../services/api';

interface Props {
  onReleased: () => void;
  onClose:    () => void;
}

const METHOD_LABELS: Record<string, string> = {
  efectivo:        'Efectivo',
  tarjeta_debito:  'Tarjeta débito',
  tarjeta_credito: 'Tarjeta crédito',
  transferencia:   'Transferencia',
};

export default function TableRelease({ onReleased, onClose }: Props) {
  const {
    paymentResult,
    selectedTable,
    activeBill,
    resetFlow,
    setProcessing,
    isProcessing,
  } = useCashierStore();

  const [localError, setLocalError] = useState<string | null>(null);
  const [released,   setReleased]   = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!paymentResult || !selectedTable || !activeBill) return null;

  const receipt = paymentResult.receipt;

  async function handleRelease() {
    if (!selectedTable) return;
    setProcessing(true);
    setLocalError(null);
    try {
      await releaseTable(selectedTable.tableId);
      setReleased(true);
      // Dar un momento para mostrar la animación de éxito
      setTimeout(() => {
        resetFlow();
        onReleased();
      }, 1_400);
    } catch (e) {
      setLocalError(
        e instanceof ApiError ? e.message : 'Error al liberar la mesa. Intenta de nuevo.'
      );
      setProcessing(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => !released && e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-title"
    >
      <div className="release-modal">

        {released ? (
          /* Animación de éxito */
          <div className="release-success" aria-live="polite">
            <div className="release-success-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="#22c55e" strokeWidth="2"/>
                <path d="M14 24l7 7 13-13" stroke="#22c55e" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className="release-success-title">¡Mesa liberada!</h3>
            <p className="release-success-sub">Mesa {selectedTable.tableNumber} disponible</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="release-header no-print">
              <div className="release-header-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="7" width="20" height="14" rx="2" stroke="#22c55e" strokeWidth="1.5"/>
                  <path d="M2 12h20" stroke="#22c55e" strokeWidth="1.5"/>
                  <path d="M7 3l5-2 5 2" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h2 className="release-title" id="release-title">Pago registrado</h2>
                <p className="release-sub">Mesa {selectedTable.tableNumber} · {activeBill.orderNumber}</p>
              </div>
              <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Comprobante de pago */}
            <div className="release-receipt" ref={printRef} id="release-printable">
              {/* Solo visible en impresión */}
              <div className="print-only receipt-print-header">
                <h1>RestaurantPWA</h1>
                <p>Comprobante de pago</p>
                <p>Mesa {receipt.tableNumber} · {receipt.section ?? ''}</p>
                {receipt.waiterName && <p>Mesero: {receipt.waiterName}</p>}
              </div>

              {/* Resumen de pago */}
              <div className="release-payment-summary">
                <div className="rps-row">
                  <span>Método</span>
                  <span className="rps-val">{METHOD_LABELS[receipt.method] ?? receipt.method}</span>
                </div>
                {receipt.reference && (
                  <div className="rps-row">
                    <span>Referencia</span>
                    <span className="rps-val">{receipt.reference}</span>
                  </div>
                )}
                <div className="rps-row">
                  <span>Pagado a las</span>
                  <span className="rps-val">
                    {new Date(receipt.paidAt).toLocaleTimeString('es', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              {/* Items (condensados) */}
              <div className="release-items">
                {receipt.items.map((item, i) => (
                  <div key={i} className="release-item-row">
                    <span>{item.quantity}× {item.name}</span>
                    <span>${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totales */}
              <div className="release-totals">
                <div className="rt-row">
                  <span>Subtotal</span>
                  <span>${receipt.subtotal.toFixed(2)}</span>
                </div>
                <div className="rt-row rt-tax">
                  <span>IVA (8%)</span>
                  <span>${receipt.tax.toFixed(2)}</span>
                </div>
                {receipt.tip > 0 && (
                  <div className="rt-row rt-tip">
                    <span>Propina</span>
                    <span>${receipt.tip.toFixed(2)}</span>
                  </div>
                )}
                <div className="rt-divider" />
                <div className="rt-row rt-total">
                  <span>TOTAL</span>
                  <span>${receipt.total.toFixed(2)}</span>
                </div>
                <div className="rt-row rt-paid">
                  <span>Recibido</span>
                  <span>${receipt.amountPaid.toFixed(2)}</span>
                </div>
                {receipt.change > 0 && (
                  <div className="rt-row rt-change">
                    <span>Cambio</span>
                    <span className="change-highlight">${receipt.change.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Footer de impresión */}
              <div className="print-only receipt-print-footer">
                <p>Orden: {activeBill.orderNumber}</p>
                <p>{new Date(receipt.paidAt).toLocaleString('es')}</p>
                <p>¡Gracias por su visita!</p>
              </div>
            </div>

            {/* Error */}
            {localError && (
              <div className="release-error" role="alert">{localError}</div>
            )}

            {/* Acciones */}
            <div className="release-footer no-print">
              <button
                type="button"
                className="release-print-btn"
                onClick={handlePrint}
                disabled={isProcessing}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <rect x="2" y="5" width="11" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M4 5V3a1 1 0 011-1h5a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M4 10h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Imprimir comprobante
              </button>
              <button
                type="button"
                className="release-confirm-btn"
                onClick={handleRelease}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <><span className="btn-spinner" aria-hidden="true" /> Liberando...</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <circle cx="8" cy="11" r="1" fill="currentColor"/>
                    </svg>
                    Liberar mesa {selectedTable.tableNumber}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}