// ============================================================
// frontend/src/components/caja/OrderClose.tsx  —  Fase 4
//
// Modal de cierre de pedido.
// Muestra el resumen del recibo y confirma la entrega al cliente.
// Al confirmar → POST /api/orders/:id/close → completed
// ============================================================

import { useRef } from 'react';
import type { OrderWithMeta } from '../../types/caja';
import type { ReceiptData } from '../../types/caja';

interface Props {
  order:     OrderWithMeta;
  receipt?:  ReceiptData;
  onConfirm: (orderId: string) => Promise<void>;
  onCancel:  () => void;
  loading:   boolean;
}

export default function OrderClose({ order, receipt, onConfirm, onCancel, loading }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const total = receipt?.total ?? parseFloat(order.total as unknown as string);

  function handlePrint() {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>Recibo #${order.order_number}</title>
      <style>
        body { font-family: monospace; padding: 20px; font-size: 13px; }
        h2   { text-align: center; margin-bottom: 4px; }
        .sep { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; }
        .total { font-weight: bold; font-size: 15px; }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="oc-modal">
        <div className="oc-modal-header">
          <h2 className="oc-modal-title">Cerrar pedido</h2>
          <button className="pp-close" onClick={onCancel}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="oc-modal-body">
          {/* Resumen del recibo */}
          <div className="receipt-card" ref={printRef}>
            <h2 className="receipt-title">RestaurantPWA</h2>
            <p className="receipt-subtitle">Recibo digital</p>
            <div className="receipt-sep" />

            <div className="receipt-row">
              <span>Orden</span>
              <span>#{order.order_number}</span>
            </div>
            <div className="receipt-row">
              <span>Fecha</span>
              <span>{new Date().toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
            <div className="receipt-sep" />

            {receipt?.items.map((item, i) => (
              <div key={i} className="receipt-row">
                <span>{item.quantity}× {item.name}</span>
                <span>${item.subtotal.toFixed(2)}</span>
              </div>
            ))}

            <div className="receipt-sep" />
            <div className="receipt-row">
              <span>Subtotal</span>
              <span>${(receipt?.subtotal ?? total).toFixed(2)}</span>
            </div>
            <div className="receipt-row">
              <span>Impuesto</span>
              <span>${(receipt?.tax ?? 0).toFixed(2)}</span>
            </div>
            <div className="receipt-sep" />
            <div className="receipt-row receipt-total">
              <span>TOTAL</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="receipt-row">
              <span>Pago</span>
              <span>{receipt?.payment_method ?? order.payment_method ?? '—'}</span>
            </div>
          </div>

          {/* Confirmación */}
          <div className="oc-confirm-msg">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="#f97316" strokeWidth="1.5"/>
              <path d="M7 10l2 2 4-4" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Confirmar que el cliente retiró su pedido
          </div>
        </div>

        <div className="oc-modal-footer">
          <button className="oc-btn-print" onClick={handlePrint} disabled={loading}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="2" y="5" width="11" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 5V3a1 1 0 011-1h5a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 10h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Imprimir recibo
          </button>
          <div className="oc-modal-actions">
            <button className="pp-btn-cancel" onClick={onCancel} disabled={loading}>
              Cancelar
            </button>
            <button
              className="pp-btn-confirm"
              onClick={() => onConfirm(order.id)}
              disabled={loading}
            >
              {loading ? <span className="btn-spinner" /> : (
                <>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M2 7.5l3.5 3.5 7.5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  Pedido entregado
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
