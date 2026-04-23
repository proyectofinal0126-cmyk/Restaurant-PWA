// ============================================================
// frontend/src/pages/caja/CajaAutoservicio.tsx
// FIX 4: Agrega botón "Historial de pedidos" en el header.
// Solo cambia el header — toda la lógica Kanban es idéntica.
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { useNavigate }       from 'react-router-dom';
import { useAppStore }       from '../../store/appStore';
import { useCajaStore }      from '../../store/cajaStore';
import { useCajaWebSocket }  from '../../hooks/useCajaWebSocket';
import {
  getActiveOrders, updateOrderStatus,
  closeOrder, getOrderDetail,
} from '../../services/cajaService';
import OrderCard        from '../../components/caja/OrderCard';
import PaymentProcessor from '../../components/caja/PaymentProcessor';
import OrderClose       from '../../components/caja/OrderClose';
import OrderHistory     from '../../components/shared/OrderHistory';   // FIX 4
import type { OrderWithMeta, ReceiptData } from '../../types/caja';
import { COLUMN_STATUSES } from '../../types/caja';
import '../../styles/caja.css';
import '../../styles/orderhistory.css';  // FIX 4

export default function CajaAutoservicio() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const token    = localStorage.getItem('rpwa-token');

  const {
    orders, loading, error,
    newOrderAlert, clearAlert,
    setOrders, setLoading, setError,
    updateStatus, removeOrder,
  } = useCajaStore();

  const [validateModal, setValidateModal] = useState<OrderWithMeta | null>(null);
  const [closeModal,    setCloseModal]    = useState<OrderWithMeta | null>(null);
  const [receipt,       setReceipt]       = useState<ReceiptData | undefined>();
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError,   setActionError]   = useState<string | null>(null);
  const [showHistory,   setShowHistory]   = useState(false);   // FIX 4

  useEffect(() => {
    setLoading(true);
    getActiveOrders()
      .then(setOrders)
      .catch((e: Error) => setError(e.message));
  }, []); // eslint-disable-line

  useCajaWebSocket(token);

  useEffect(() => {
    if (!newOrderAlert) return;
    try {
      const ctx  = new AudioContext();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* AudioContext no soportado */ }
    clearAlert();
  }, [newOrderAlert, clearAlert]);

  useEffect(() => {
    const t = setInterval(() => setOrders([...orders]), 60_000);
    return () => clearInterval(t);
  }, [orders, setOrders]);

  const handleValidate = useCallback(async (orderId: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await getOrderDetail(orderId);
      await updateOrderStatus(orderId, 'sent_to_kitchen');
      updateStatus(orderId, 'sent_to_kitchen');
      setValidateModal(null);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Error al enviar a cocina');
    } finally {
      setActionLoading(false);
    }
  }, [updateStatus]);

  const handleClose = useCallback(async (orderId: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await closeOrder(orderId, {});
      setReceipt(result.receipt);
      removeOrder(orderId);
      setCloseModal(null);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Error al cerrar pedido');
    } finally {
      setActionLoading(false);
    }
  }, [removeOrder]);

  const col = (key: keyof typeof COLUMN_STATUSES) =>
    orders
      .filter((o) => COLUMN_STATUSES[key].includes(o.status))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const pendientes = col('pendientes');
  const enCocina   = col('en_cocina');
  const listos     = col('listos');

  return (
    <div className="caja-root">
      <header className="caja-header">
        <div className="caja-header-left">
          <div className="caja-logo">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <rect x="2" y="6" width="22" height="16" rx="2" stroke="#f97316" strokeWidth="1.5"/>
              <path d="M2 11h22M8 16h2M16 16h2" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9 3l4-2 4 2" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="caja-title">Caja Autoservicio</h1>
            <p className="caja-subtitle">{user?.name ?? 'Cajero'}</p>
          </div>
        </div>
        <div className="caja-header-right">
          <div className="caja-stats">
            <span className="stat-pill stat-yellow">{pendientes.length} pendientes</span>
            <span className="stat-pill stat-orange">{enCocina.length} en cocina</span>
            <span className="stat-pill stat-green">{listos.length} listos</span>
          </div>
          {/* FIX 4: Botón historial */}
          <button
            type="button"
            className="history-trigger-btn"
            onClick={() => setShowHistory(true)}
            aria-label="Ver historial de pedidos del día"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7.5 4.5v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Historial
          </button>
          <button className="caja-exit-btn" onClick={() => navigate('/')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M10 11l4-4-4-4M14 7H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Salir
          </button>
        </div>
      </header>

      {(error || actionError) && (
        <div className="caja-error-banner">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M7 4.5v3M7 9v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {error ?? actionError}
          <button className="banner-close" onClick={() => { setError(null); setActionError(null); }}>×</button>
        </div>
      )}

      {loading ? (
        <div className="caja-loading">
          <div className="caja-spinner" />
          <p>Cargando órdenes activas...</p>
        </div>
      ) : (
        <div className="caja-kanban">
          <div className="kanban-col">
            <div className="col-header col-header--yellow">
              <div className="col-dot dot-yellow" />
              <span className="col-title">Pendientes de validar</span>
              <span className="col-badge">{pendientes.length}</span>
            </div>
            <div className="col-body">
              {pendientes.length === 0
                ? <div className="col-empty"><span>Sin órdenes pendientes</span></div>
                : pendientes.map((o) => (
                    <OrderCard key={o.id} order={o}
                      onValidate={(ord) => setValidateModal(ord)}
                      onClose={(ord) => setCloseModal(ord)}
                      disabled={actionLoading} />
                  ))
              }
            </div>
          </div>

          <div className="kanban-col">
            <div className="col-header col-header--orange">
              <div className="col-dot dot-orange" />
              <span className="col-title">En cocina</span>
              <span className="col-badge">{enCocina.length}</span>
            </div>
            <div className="col-body">
              {enCocina.length === 0
                ? <div className="col-empty"><span>Cocina sin órdenes</span></div>
                : enCocina.map((o) => (
                    <OrderCard key={o.id} order={o}
                      onValidate={(ord) => setValidateModal(ord)}
                      onClose={(ord) => setCloseModal(ord)}
                      disabled={actionLoading} />
                  ))
              }
            </div>
          </div>

          <div className="kanban-col">
            <div className="col-header col-header--green">
              <div className="col-dot dot-green" />
              <span className="col-title">Listos para entregar</span>
              <span className="col-badge">{listos.length}</span>
            </div>
            <div className="col-body">
              {listos.length === 0
                ? <div className="col-empty"><span>Nada listo aún</span></div>
                : listos.map((o) => (
                    <OrderCard key={o.id} order={o}
                      onValidate={(ord) => setValidateModal(ord)}
                      onClose={(ord) => setCloseModal(ord)}
                      disabled={actionLoading} />
                  ))
              }
            </div>
          </div>
        </div>
      )}

      {validateModal && (
        <PaymentProcessor
          order={validateModal}
          onConfirm={handleValidate}
          onCancel={() => { setValidateModal(null); setActionError(null); }}
          loading={actionLoading}
        />
      )}
      {closeModal && (
        <OrderClose
          order={closeModal}
          receipt={receipt}
          onConfirm={handleClose}
          onCancel={() => { setCloseModal(null); setActionError(null); setReceipt(undefined); }}
          loading={actionLoading}
        />
      )}

      {/* FIX 4: Modal de historial */}
      {showHistory && (
        <OrderHistory onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}