// ============================================================
// frontend/src/pages/Checkout.tsx  →  /autoservicio/checkout
//
// CAMBIOS vs Fase 3 original:
// - ELIMINADO: toda referencia a tableId / tableNumber / mesa.
// - CORREGIDO: payload enviado al backend tiene
//     table_id: null        (explícito, no undefined)
//     source: 'autoservicio' (literal tipado)
// - El tipo CreateOrderPayload enforza ambos en tiempo de compilación.
// ============================================================

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { useOrderStore } from '../store/orderStore';
import { createOrder } from '../services/orderService';
import { ApiError } from '../services/api';
import type { CreateOrderPayload } from '../types/order';
import '../styles/checkout.css';

type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'efectivo',      label: 'Efectivo',      icon: '💵' },
  { value: 'tarjeta',       label: 'Tarjeta',        icon: '💳' },
  { value: 'transferencia', label: 'Transferencia',  icon: '📲' },
];

export default function Checkout() {
  const navigate            = useNavigate();
  const { items, getTotal, clearCart } = useCartStore();
  const setActiveOrder      = useOrderStore((s) => s.setActiveOrder);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Carrito vacío → volver al menú
  if (items.length === 0) {
    return <Navigate to="/autoservicio/menu" replace />;
  }

  const subtotal = getTotal();
  const tax      = subtotal * 0.08;
  const total    = subtotal + tax;

  async function handleConfirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // CRÍTICO: table_id es null — autoservicio no gestiona mesas.
    // source es 'autoservicio' — literal estricto tipado por CreateOrderPayload.
    const payload: CreateOrderPayload = {
      table_id:       null,           // ← siempre null en autoservicio
      source:         'autoservicio', // ← literal tipado, no genérico
      items: items.map((ci) => ({
        menu_item_id:         ci.menuItem.id,
        quantity:             ci.quantity,
        special_instructions: ci.notes,
      })),
      payment_method: paymentMethod,
      notes,
    };

    try {
      const order = await createOrder(payload);
      setActiveOrder(order);
      clearCart();
      navigate(`/autoservicio/tracker/${order.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Error al confirmar el pedido. Intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="checkout-root">
      <div className="checkout-bg" />

      {/* Header — sin referencia a mesa */}
      <header className="checkout-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Volver al menú
        </button>
        <span className="checkout-badge">Autoservicio</span>
      </header>

      <div className="checkout-wrap">
        <form className="checkout-form" onSubmit={handleConfirm}>

          <div className="checkout-hero">
            <h1 className="checkout-h1">Confirmar pedido</h1>
            <p className="checkout-sub">Revisa tu orden antes de enviar</p>
          </div>

          {/* Resumen de items */}
          <section className="checkout-section">
            <h2 className="section-title">Tu pedido</h2>
            <ul className="checkout-items">
              {items.map(({ menuItem, quantity, notes: itemNotes }) => (
                <li key={menuItem.id} className="checkout-item">
                  <div className="ci-qty">{quantity}×</div>
                  <div className="ci-info">
                    <span className="ci-name">{menuItem.name}</span>
                    {itemNotes && (
                      <span className="ci-notes">{itemNotes}</span>
                    )}
                  </div>
                  <span className="ci-price">
                    ${(menuItem.price * quantity).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Método de pago */}
          <section className="checkout-section">
            <h2 className="section-title">Método de pago</h2>
            <div className="payment-options">
              {PAYMENT_OPTIONS.map(({ value, label, icon }) => (
                <label
                  key={value}
                  className={`payment-opt ${paymentMethod === value ? 'payment-opt--active' : ''}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={value}
                    checked={paymentMethod === value}
                    onChange={() => setPaymentMethod(value)}
                    className="sr-only"
                  />
                  <span className="payment-icon">{icon}</span>
                  <span className="payment-label">{label}</span>
                  {paymentMethod === value && (
                    <svg className="payment-check" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </section>

          {/* Notas */}
          <section className="checkout-section">
            <h2 className="section-title">
              Notas especiales <span className="optional">(opcional)</span>
            </h2>
            <textarea
              className="checkout-notes"
              placeholder="Ej: Sin cebolla, alergia a los mariscos..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={300}
            />
            <p className="char-count">{notes.length}/300</p>
          </section>

          {/* Totales */}
          <section className="checkout-totals">
            <div className="total-row">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="total-row total-row--tax">
              <span>Impuesto (8%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="total-divider" />
            <div className="total-row total-row--final">
              <span>Total estimado</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <p className="total-note">* El total final lo confirma caja</p>
          </section>

          {/* Error */}
          {error && (
            <div className="checkout-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v3M8 10v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="confirm-btn" disabled={loading}>
            {loading ? (
              <><span className="btn-spinner" /> Enviando pedido...</>
            ) : (
              <>
                Confirmar pedido
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
