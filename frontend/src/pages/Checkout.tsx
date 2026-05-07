import { formatCOP } from '../utils/constants';
// ============================================================
// frontend/src/pages/Checkout.tsx  →  /autoservicio/checkout
//
// MEJORA F9: Después de confirmar el pedido se muestra una
//   pantalla de éxito con número de orden y detalle completo,
//   en lugar de redirigir directamente al tracker.
//   El cliente puede ir al tracker desde esa pantalla.
// ============================================================
import { Banknote, CreditCard, ArrowLeftRight } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCartStore }  from '../store/cartStore';
import { useOrderStore } from '../store/orderStore';
import { createOrder }   from '../services/orderService';
import { ApiError }      from '../services/api';
import type { CreateOrderPayload, Order } from '../types/order';
import '../styles/checkout.css';

type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'efectivo',      label: 'Efectivo',      icon: <Banknote size={20}/> },
  { value: 'tarjeta',       label: 'Tarjeta',        icon: <CreditCard size={20}/> },
  { value: 'transferencia', label: 'Transferencia',  icon: <ArrowLeftRight size={20}/> },
];
// ── Pantalla de confirmación ──────────────────────────────────
function OrderConfirmed({ order, onTrack, onNew }: {
  order: Order;
  onTrack: () => void;
  onNew:   () => void;
}) {
  const subtotal = parseFloat(order.subtotal as unknown as string);
  const tax      = parseFloat(order.tax      as unknown as string ?? '0');
  const total    = parseFloat(order.total    as unknown as string);

  return (
    <div className="checkout-root">
      <div className="checkout-bg" />

      <div className="checkout-wrap">
        <div className="order-confirmed-card">

          {/* Ícono de éxito */}
          <div className="oc-icon-wrap">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="20" fill="rgba(34,197,94,0.12)" stroke="#22c55e" strokeWidth="1.8"/>
              <path d="M13 22l6 6 12-12" stroke="#22c55e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div className="oc-header">
            <h1 className="oc-title">¡Pedido confirmado!</h1>
            <p className="oc-sub">Tu orden fue registrada correctamente</p>
          </div>

          {/* Número de orden — destacado */}
          <div className="oc-order-num-box">
            <span className="oc-num-label">Número de orden</span>
            <span className="oc-num">{order.order_number}</span>
            <span className="oc-num-hint">Guarda este número para retirar tu pedido</span>
          </div>

          {/* Detalle de items */}
          <div className="oc-items-section">
            <h3 className="oc-items-title">Detalle del pedido</h3>
            <ul className="oc-items-list">
              {(order.items ?? []).map((item) => (
                <li key={item.id ?? item.menu_item_id} className="oc-item">
                  <span className="oc-item-qty">{item.quantity}×</span>
                  <span className="oc-item-name">{item.name}</span>
                  <span className="oc-item-price">
                    {formatCOP(parseFloat(item.price as unknown as string) * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Totales */}
            <div className="oc-totals">
              <div className="oc-total-row">
                <span>Subtotal</span>
                <span>{formatCOP(subtotal)}</span>
              </div>
              <div className="oc-total-row oc-total-tax">
                <span>Impuesto (8%)</span>
                <span>{formatCOP(tax)}</span>
              </div>
              <div className="oc-total-divider"/>
              <div className="oc-total-row oc-total-final">
                <span>Total</span>
                <span>{formatCOP(total)}</span>
              </div>
            </div>
          </div>

          {/* Método de pago */}
          <div className="oc-payment-info">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1 7h14" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Pago: <strong>{
             order.payment_method === 'efectivo' ? 'Efectivo'
: order.payment_method === 'tarjeta' ? 'Tarjeta'
: 'Transferencia'
            }</strong>
          </div>

          {/* Acciones */}
          <div className="oc-actions">
            <button className="oc-track-btn" onClick={onTrack}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M9 5v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Seguir mi pedido en tiempo real
            </button>
            <button className="oc-new-btn" onClick={onNew}>
              Hacer otro pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pantalla principal de checkout ───────────────────────────
export default function Checkout() {
  const navigate                       = useNavigate();
  const { items, getTotal, clearCart } = useCartStore();
  const setActiveOrder                 = useOrderStore((s) => s.setActiveOrder);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [notes,   setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  // Carrito vacío → volver al menú
  if (items.length === 0 && !confirmedOrder) {
    return <Navigate to="/autoservicio/menu" replace />;
  }

  // ── Mostrar confirmación ─────────────────────────────────
  if (confirmedOrder) {
    return (
      <OrderConfirmed
        order={confirmedOrder}
        onTrack={() => navigate(`/autoservicio/tracker/${confirmedOrder.id}`)}
        onNew={() => navigate('/autoservicio/menu')}
      />
    );
  }

  const subtotal = getTotal();
  const tax      = subtotal * 0.08;
  const total    = subtotal + tax;

  async function handleConfirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: CreateOrderPayload = {
      table_id:       null,
      source:         'autoservicio',
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
      // ✅ Mostrar pantalla de confirmación en lugar de redirigir
      setConfirmedOrder(order);
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
                    {itemNotes && <span className="ci-notes">{itemNotes}</span>}
                  </div>
                  <span className="ci-price">{formatCOP(menuItem.price * quantity)}</span>
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
                  <input type="radio" name="payment" value={value}
                    checked={paymentMethod === value}
                    onChange={() => setPaymentMethod(value)}
                    className="sr-only"/>
                  <span className="payment-icon">{icon}</span>
                  <span className="payment-label">{label}</span>
                  {paymentMethod === value && (
                    <svg className="payment-check" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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
            <textarea className="checkout-notes"
              placeholder="Ej: Sin cebolla, alergia a los mariscos..."
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} maxLength={300}/>
            <p className="char-count">{notes.length}/300</p>
          </section>

          {/* Totales */}
          <section className="checkout-totals">
            <div className="total-row"><span>Subtotal</span><span>{formatCOP(subtotal)}</span></div>
            <div className="total-row total-row--tax"><span>Impuesto (8%)</span><span>{formatCOP(tax)}</span></div>
            <div className="total-divider"/>
            <div className="total-row total-row--final"><span>Total estimado</span><span>{formatCOP(total)}</span></div>
            <p className="total-note">* El total final lo confirma caja</p>
          </section>

          {error && (
            <div className="checkout-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v3M8 10v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="confirm-btn" disabled={loading}>
            {loading ? (
              <><span className="btn-spinner"/> Enviando pedido...</>
            ) : (
              <>Confirmar pedido
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}