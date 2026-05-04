import { formatCOP } from '../utils/constants';
// ============================================================
// frontend/src/pages/OrderTracker.tsx  →  /autoservicio/tracker/:id
// FIX: import CSS en lowercase para compatibilidad Linux/Docker
// FIX: price de items viene como string de BD → parseFloat
// ============================================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrderStore }   from '../store/orderStore';
import { getOrderById }    from '../services/orderService';
import { useWebSocket }    from '../hooks/useWebSocket';
import type { Order, OrderStatus, WsOrderReadyEvent } from '../types/order';
import '../styles/ordertracker.css'; // ← lowercase

const STEPS: { status: OrderStatus; label: string; sub: string; icon: React.ReactNode }[] = [
  {
    status: 'pending_payment', label: 'Recibido', sub: 'Tu pedido fue registrado correctamente',
    icon: (<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M7 11l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  },
  {
    status: 'sent_to_kitchen', label: 'En preparación', sub: 'La cocina está preparando tu pedido',
    icon: (<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M7 20V13a5 5 0 0110 0v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M4 20h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M11 7V4M8.5 8L7 5.5M13.5 8L15 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  },
  {
    status: 'ready_for_pickup', label: '¡Listo!', sub: 'Tu pedido está listo — pasa a retirarlo',
    icon: (<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2l2.5 5.5 6 .9-4.3 4.2 1 6L11 16l-5.2 2.6 1-6L2.5 8.4l6-.9L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>),
  },
  {
    status: 'completed', label: 'Entregado', sub: '¡Buen provecho!',
    icon: (<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11l5 5L18 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  },
];

function getActiveStep(status: OrderStatus): number {
  if (['pending_payment','payment_confirmed','pending_validation'].includes(status)) return 0;
  if (['sent_to_kitchen','in_preparation'].includes(status)) return 1;
  if (status === 'ready_for_pickup') return 2;
  if (['delivered','completed'].includes(status)) return 3;
  return 0;
}

function getStatusDisplay(status: OrderStatus): { title: string; color: string } {
  const map: Partial<Record<OrderStatus,{title:string;color:string}>> = {
    pending_payment:    { title:'Pedido recibido',      color:'#6b6775' },
    payment_confirmed:  { title:'Pago confirmado',      color:'#3b82f6' },
    pending_validation: { title:'Validando pedido...',  color:'#eab308' },
    sent_to_kitchen:    { title:'Enviado a cocina',     color:'#f97316' },
    in_preparation:     { title:'En preparación 🔥',   color:'#f97316' },
    ready_for_pickup:   { title:'¡Pedido listo! 🎉',   color:'#22c55e' },
    delivered:          { title:'En camino',            color:'#22c55e' },
    completed:          { title:'¡Buen provecho! 🍽️', color:'#22c55e' },
    cancelled:          { title:'Pedido cancelado',     color:'#ef4444' },
  };
  return map[status] ?? { title:'Procesando...', color:'#6b6775' };
}

export default function OrderTracker() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeOrder, setActiveOrder } = useOrderStore();

  const [order,      setOrder]      = useState<Order | null>(activeOrder);
  const [loading,    setLoading]    = useState(!activeOrder);
  const [error,      setError]      = useState<string | null>(null);
  const [readyAlert, setReadyAlert] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (activeOrder?.id === id) { setOrder(activeOrder); return; }
    setLoading(true);
    getOrderById(id)
      .then((data) => { setOrder(data); setActiveOrder(data); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line

  useEffect(() => {
    if (activeOrder?.id === id) {
      setOrder((prev) => prev ? { ...prev, status: activeOrder.status } : activeOrder);
    }
  }, [activeOrder?.status]); // eslint-disable-line

  useWebSocket({
    orderId: id ?? null,
    onStatusChange: () => {},
    onReady: (_e: WsOrderReadyEvent) => {
      setReadyAlert(true);
      setTimeout(() => setReadyAlert(false), 6000);
    },
  });

  if (loading) return (
    <div className="tracker-loading">
      <div className="tracker-spinner" /><p>Cargando tu pedido...</p>
    </div>
  );

  if (error || !order) return (
    <div className="tracker-error">
      <p>No se pudo cargar el pedido</p>
      <span>{error ?? 'Orden no encontrada'}</span>
      <button onClick={() => navigate('/autoservicio/menu')}>Volver al menú</button>
    </div>
  );

  const activeStep    = getActiveStep(order.status);
  const statusDisplay = getStatusDisplay(order.status);
  const isCompleted   = ['delivered','completed'].includes(order.status);
  const isReady       = order.status === 'ready_for_pickup';

  return (
    <div className="tracker-root">
      <div className="tracker-bg">
        <div className={`tracker-blob ${isReady ? 'tb-green' : 'tb-orange'}`} />
      </div>

      <header className="tracker-header">
        <span className="tracker-order-num">Pedido #{order.order_number}</span>
        <span className="tracker-source">{order.table_id ? 'Mesa asignada' : 'Para llevar'}</span>
      </header>

      <div className="tracker-status-card"
        style={{ '--status-color': statusDisplay.color } as React.CSSProperties}>
        <div className="tracker-status-dot" />
        <div>
          <h1 className="tracker-status-title">{statusDisplay.title}</h1>
          <p className="tracker-status-sub">{STEPS[activeStep]?.sub ?? 'Procesando...'}</p>
        </div>
      </div>

      {readyAlert && (
        <div className="tracker-ready-alert">
          <span className="ready-icon">🎉</span>
          <div>
            <p className="ready-title">¡Tu pedido está listo!</p>
            <p className="ready-sub">Pasa a retirarlo al mostrador</p>
          </div>
          <button className="ready-close" onClick={() => setReadyAlert(false)}>×</button>
        </div>
      )}

      <div className="tracker-timeline">
        {STEPS.map((step, i) => {
          const isDone = i < activeStep, isActive = i === activeStep, isPending = i > activeStep;
          return (
            <div key={step.status} className={`tl-step ${isDone?'tl-done':''} ${isActive?'tl-active':''} ${isPending?'tl-pending':''}`}>
              {i < STEPS.length - 1 && <div className={`tl-line ${isDone||isActive?'tl-line--active':''}`} />}
              <div className="tl-icon-wrap">
                {isDone
                  ? <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
                  : step.icon}
                {isActive && <div className="tl-pulse" />}
              </div>
              <div className="tl-text">
                <span className="tl-label">{step.label}</span>
                {isActive && <span className="tl-sub">{step.sub}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="tracker-items-card">
        <h3 className="tracker-items-title">Detalle del pedido</h3>
        {order.items?.length ? (
          <ul className="tracker-items-list">
            {order.items.map((item) => (
              <li key={item.id} className="tracker-item">
                <span className="ti-qty">{item.quantity}×</span>
                <span className="ti-name">{item.name}</span>
                {/* FIX: price puede venir como string de BD */}
                <span className="ti-price">{formatCOP(parseFloat(item.price as unknown as string) * item.quantity)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="tracker-items-empty">Cargando items...</p>}
        <div className="tracker-total">
          <span>Total</span>
          <span>{formatCOP(parseFloat(order.total as unknown as string))}</span>
        </div>
      </div>

      {isCompleted && (
        <div className="tracker-done-actions">
          <p className="done-msg">¡Gracias por tu visita!</p>
          <button className="done-btn" onClick={() => navigate('/autoservicio/menu')}>
            Hacer otro pedido
          </button>
        </div>
      )}
    </div>
  );
}
