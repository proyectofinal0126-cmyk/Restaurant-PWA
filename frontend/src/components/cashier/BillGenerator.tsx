// ============================================================
// frontend/src/components/cashier/BillGenerator.tsx  —  Fase 7
//
// Propósito: Modal que genera y muestra la cuenta detallada de
//   una mesa antes de procesar el pago. Permite imprimir la
//   vista previa con window.print() + CSS @media print.
//
// Ruta: frontend/src/components/cashier/BillGenerator.tsx
// Dependencias: React 19, cashierService, cashierStore
//
// Props:
//   interface Props {
//     onProceedToPayment: () => void;  // avanza al modal de pago
//     onClose:            () => void;  // cierra sin pagar
//   }
//
// Flujo de datos:
//   1. Lee selectedTable del cashierStore
//   2. POST /cashier/orders/:orderId/bill → BillDetail
//   3. Guarda en cashierStore.activeBill
//   4. Renderiza tabla de items + totales + propina sugerida
//   5. "Procesar Pago" → onProceedToPayment()
//   6. "Imprimir" → window.print() con CSS @media print
//
// Notas: La propina sugerida (10%) es informativa — el cliente
//   decide si la agrega. El campo tip real se registra en PaymentMethod.
// ============================================================

import { useEffect, useState } from 'react';
import { useCashierStore }     from '../../store/cashierStore';
import { generateBill }        from '../../services/cashierService';
import { ApiError }            from '../../services/api';

interface Props {
  onProceedToPayment: () => void;
  onClose:            () => void;
}

export default function BillGenerator({ onProceedToPayment, onClose }: Props) {
  const { selectedTable, activeBill, setActiveBill, setError } = useCashierStore();
  const [loading, setLoading] = useState(!activeBill);
  const [localError, setLocalError] = useState<string | null>(null);

  // Cargar la cuenta si aún no está en el store
  useEffect(() => {
    if (!selectedTable || activeBill) return;

    setLoading(true);
    generateBill(selectedTable.orderId)
      .then((bill) => {
        setActiveBill(bill);
        setLoading(false);
      })
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : 'Error al generar la cuenta';
        setLocalError(msg);
        setError(msg);
        setLoading(false);
      });
  }, [selectedTable]); // eslint-disable-line

  if (!selectedTable) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bill-title"
    >
      <div className="bill-modal">
        {/* Header */}
        <div className="bill-header no-print">
          <div>
            <h2 className="bill-title" id="bill-title">
              Cuenta — Mesa {selectedTable.tableNumber}
            </h2>
            {selectedTable.section && (
              <p className="bill-section">{selectedTable.section}</p>
            )}
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Contenido de la cuenta */}
        <div className="bill-body" id="bill-printable">
          {loading ? (
            <div className="bill-loading">
              <div className="cashier-spinner" />
              <p>Generando cuenta...</p>
            </div>
          ) : localError ? (
            <div className="bill-error" role="alert">
              <p>{localError}</p>
              <button onClick={() => { setLocalError(null); setLoading(true); }}>
                Reintentar
              </button>
            </div>
          ) : activeBill ? (
            <>
              {/* Encabezado del recibo (visible en impresión también) */}
              <div className="receipt-header print-only">
                <h1 className="receipt-brand">RestaurantPWA</h1>
                <p>Mesa {activeBill.tableNumber} · {activeBill.section ?? ''}</p>
                {activeBill.waiterName && <p>Mesero: {activeBill.waiterName}</p>}
                <p>{new Date(activeBill.createdAt).toLocaleString('es')}</p>
              </div>

              {/* Info de la orden */}
              <div className="bill-order-info no-print">
                <span className="bill-order-num">{activeBill.orderNumber}</span>
                {activeBill.waiterName && (
                  <span className="bill-waiter">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1"/>
                      <path d="M2 10c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                    {activeBill.waiterName}
                  </span>
                )}
              </div>

              {/* Tabla de items */}
              <table className="bill-items-table">
                <thead>
                  <tr>
                    <th className="col-item">Item</th>
                    <th className="col-qty">Cant.</th>
                    <th className="col-price">P/U</th>
                    <th className="col-sub">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBill.items.map((item, i) => (
                    <tr key={i}>
                      <td className="col-item">
                        {item.name}
                        {item.specialInstructions && (
                          <span className="item-note">— {item.specialInstructions}</span>
                        )}
                      </td>
                      <td className="col-qty">{item.quantity}</td>
                      <td className="col-price">${item.unitPrice.toFixed(2)}</td>
                      <td className="col-sub">${item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totales */}
              <div className="bill-totals">
                <div className="bill-total-row">
                  <span>Subtotal</span>
                  <span>${activeBill.subtotal.toFixed(2)}</span>
                </div>
                <div className="bill-total-row bill-tax-row">
                  <span>IVA (8%)</span>
                  <span>${activeBill.tax.toFixed(2)}</span>
                </div>
                <div className="bill-total-row bill-tip-row no-print">
                  <span>
                    Propina sugerida (10%)
                    <small> — opcional</small>
                  </span>
                  <span className="tip-amount">${activeBill.suggestedTip.toFixed(2)}</span>
                </div>
                <div className="bill-divider" />
                <div className="bill-total-row bill-grand-total">
                  <span>TOTAL</span>
                  <span>${activeBill.total.toFixed(2)}</span>
                </div>
                <p className="bill-note no-print">
                  * Propina no incluida en el total. Se agrega al confirmar el pago.
                </p>
              </div>

              {/* Footer de impresión */}
              <div className="receipt-footer print-only">
                <p>Orden: {activeBill.orderNumber}</p>
                <p>Generada: {new Date(activeBill.generatedAt).toLocaleString('es')}</p>
                <p>¡Gracias por su visita!</p>
              </div>
            </>
          ) : null}
        </div>

        {/* Acciones */}
        {activeBill && !loading && !localError && (
          <div className="bill-footer no-print">
            <button
              type="button"
              className="bill-print-btn"
              onClick={() => window.print()}
              aria-label="Imprimir vista previa de la cuenta"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="5" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M5 5V3a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M5 10h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Imprimir
            </button>
            <button
              type="button"
              className="bill-pay-btn"
              onClick={onProceedToPayment}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M2 7h12" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
              Procesar pago
            </button>
          </div>
        )}
      </div>
    </div>
  );
}