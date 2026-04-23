// ============================================================
// frontend/src/pages/cocina/KDS.tsx  →  /cocina/kds
//
// Kitchen Display System — pantalla principal.
// Optimizada para tablets horizontales (1024x768+).
//
// LAYOUT: 3 columnas Kanban
//   Nuevas | En preparación | Listas
//
// FLUJO:
//   sent_to_kitchen  → columna Nuevas    → botón "Aceptar"
//   in_preparation   → columna Preparando → checkboxes + "Marcar listo"
//   ready_for_pickup → columna Listas    → solo visual
//
// TIEMPO REAL: useKitchenSocket conecta como role=cocina
// y recibe broadcast global del servidor.
//
// AUDIO: unlockAudio() al primer click (política del navegador)
//   alertNewOrder()   → nueva orden llega
//   alertOrderReady() → orden marcada lista
// ============================================================

import { useEffect, useCallback } from 'react';
import { useNavigate }            from 'react-router-dom';
import { useAppStore }            from '../../store/appStore';
import { useKitchenStore }        from '../../store/kitchenStore';
import { KDS_COLUMN_STATUSES }    from '../../store/kitchenStore';
import { useKitchenSocket }       from '../../hooks/useKitchenSocket';
import { apiFetch }               from '../../services/api';
import { alertNewOrder, alertOrderReady, unlockAudio } from '../../utils/audioAlert';
import OrderPrep                  from '../../components/kitchen/OrderPrep';
import type { Order }             from '../../types/order';
import '../../styles/kds.css';

export default function KDS() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const token    = localStorage.getItem('rpwa-token');

  const {
    orders,
    loading,
    error,
    newOrderAlert,
    clearAlert,
    setOrders,
    setLoading,
    setError,
    updateStatus,
    resetItemsCompleted,
  } = useKitchenStore();

  // ── Carga inicial ───────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    apiFetch<Order[]>('/orders/active')
      .then((data) => {
        // Filtrar solo órdenes relevantes para cocina
        const kitchenOrders = data.filter((o) =>
          ['sent_to_kitchen', 'in_preparation', 'ready_for_pickup'].includes(o.status)
        );
        setOrders(kitchenOrders);
      })
      .catch((e: Error) => setError(e.message));
  }, []); // eslint-disable-line

  // ── WebSocket en tiempo real ────────────────────────────────
  useKitchenSocket(token);

  // ── Alerta sonora nueva orden ───────────────────────────────
  useEffect(() => {
    if (!newOrderAlert) return;
    alertNewOrder();
    clearAlert();
  }, [newOrderAlert, clearAlert]);

  // ── Desbloquear AudioContext al primer click ────────────────
  useEffect(() => {
    const unlock = () => unlockAudio();
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);

  // ── Fullscreen API ──────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // ── Acción: Aceptar orden (sent_to_kitchen → in_preparation) ──
  const handleAccept = useCallback(async (orderId: string) => {
    try {
      await apiFetch(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body:   JSON.stringify({ status: 'in_preparation' }),
      });
      updateStatus(orderId, 'in_preparation');
      resetItemsCompleted(orderId);
    } catch (e: unknown) {
      console.error('[KDS] handleAccept error:', e);
    }
  }, [updateStatus, resetItemsCompleted]);

  // ── Acción: Marcar listo (in_preparation → ready_for_pickup) ──
  const handleReady = useCallback(async (orderId: string) => {
    try {
      await apiFetch(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body:   JSON.stringify({ status: 'ready_for_pickup' }),
      });
      updateStatus(orderId, 'ready_for_pickup');
      alertOrderReady();
    } catch (e: unknown) {
      console.error('[KDS] handleReady error:', e);
    }
  }, [updateStatus]);

  // ── Filtrar órdenes por columna ─────────────────────────────
  const col = useCallback(
    (key: keyof typeof KDS_COLUMN_STATUSES) =>
      orders
        .filter((o) => KDS_COLUMN_STATUSES[key].includes(o.status))
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
    [orders]
  );

  const nuevas       = col('nuevas');
  const enPrep       = col('en_preparacion');
  const listas       = col('listas');
  const totalOrdenes = orders.length;

  return (
    <div className="kds-root">
      {/* ── Header ── */}
      <header className="kds-header">
        <div className="kds-header-left">
          {/* Ícono de cocina */}
          <div className="kds-logo" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path d="M6 22v-8a7 7 0 1114 0v8" stroke="#f97316" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M3 22h20" stroke="#f97316" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M13 7V4M9.5 8.5L8 5.5M16.5 8.5L18 5.5" stroke="#f97316" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="kds-title">Kitchen Display</h1>
            <p className="kds-subtitle">{user?.name ?? 'Cocina'}</p>
          </div>
        </div>

        <div className="kds-header-center">
          <span className="kds-pill kds-pill--red">{nuevas.length} nuevas</span>
          <span className="kds-pill kds-pill--orange">{enPrep.length} preparando</span>
          <span className="kds-pill kds-pill--green">{listas.length} listas</span>
        </div>

        <div className="kds-header-right">
          <span className="kds-total-label">
            {totalOrdenes} {totalOrdenes === 1 ? 'orden' : 'órdenes'}
          </span>
          {/* Botón pantalla completa */}
          <button
            type="button"
            className="kds-icon-btn"
            onClick={toggleFullscreen}
            aria-label="Pantalla completa"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            type="button"
            className="kds-exit-btn"
            onClick={() => navigate('/')}
            aria-label="Salir del KDS"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M10 11l4-4-4-4M14 7H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Salir
          </button>
        </div>
      </header>

      {/* ── Error global ── */}
      {error && (
        <div className="kds-error-banner" role="alert">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M7 4.5v3M7 9v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {error}
          <button className="kds-banner-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading ? (
        <div className="kds-loading" aria-busy="true" aria-live="polite">
          <div className="kds-spinner" aria-hidden="true" />
          <p>Cargando órdenes...</p>
        </div>
      ) : (
        /* ── Kanban 3 columnas ── */
        <main className="kds-kanban" aria-label="Dashboard de cocina">

          {/* Columna Nuevas */}
          <section className="kds-col" aria-label={`Nuevas: ${nuevas.length} órdenes`}>
            <div className="kds-col-header kds-col-header--red">
              <span className="kds-col-dot" aria-hidden="true" />
              <h2 className="kds-col-title">Nuevas</h2>
              <span className="kds-col-count" aria-hidden="true">{nuevas.length}</span>
            </div>
            <div className="kds-col-body">
              {nuevas.length === 0 ? (
                <KDSEmptyCol message="Sin órdenes nuevas" icon="inbox" />
              ) : (
                nuevas.map((o) => (
                  <OrderPrep
                    key={o.id}
                    order={o}
                    onAccept={handleAccept}
                    onReady={handleReady}
                  />
                ))
              )}
            </div>
          </section>

          {/* Columna En preparación */}
          <section className="kds-col" aria-label={`En preparación: ${enPrep.length} órdenes`}>
            <div className="kds-col-header kds-col-header--orange">
              <span className="kds-col-dot" aria-hidden="true" />
              <h2 className="kds-col-title">En preparación</h2>
              <span className="kds-col-count" aria-hidden="true">{enPrep.length}</span>
            </div>
            <div className="kds-col-body">
              {enPrep.length === 0 ? (
                <KDSEmptyCol message="Nada en preparación" icon="fire" />
              ) : (
                enPrep.map((o) => (
                  <OrderPrep
                    key={o.id}
                    order={o}
                    onAccept={handleAccept}
                    onReady={handleReady}
                  />
                ))
              )}
            </div>
          </section>

          {/* Columna Listas */}
          <section className="kds-col" aria-label={`Listas: ${listas.length} órdenes`}>
            <div className="kds-col-header kds-col-header--green">
              <span className="kds-col-dot" aria-hidden="true" />
              <h2 className="kds-col-title">Listas</h2>
              <span className="kds-col-count" aria-hidden="true">{listas.length}</span>
            </div>
            <div className="kds-col-body">
              {listas.length === 0 ? (
                <KDSEmptyCol message="Sin órdenes listas" icon="check" />
              ) : (
                listas.map((o) => (
                  <OrderPrep
                    key={o.id}
                    order={o}
                    onAccept={handleAccept}
                    onReady={handleReady}
                  />
                ))
              )}
            </div>
          </section>

        </main>
      )}
    </div>
  );
}

// ── Componente auxiliar: columna vacía ───────────────────────
function KDSEmptyCol({ message, icon }: { message: string; icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    inbox: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="4" y="16" width="32" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.25"/>
        <path d="M4 24h9l3 4h8l3-4h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.25"/>
        <path d="M14 10h12M16 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2"/>
      </svg>
    ),
    fire: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <path d="M20 6c0 5.5-6 9-6 14a9 9 0 1018 0c0-5-5-8-5-11-2.5 2.5-2.5 5-2.5 6C22 13 20 10 20 6z"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.25"/>
      </svg>
    ),
    check: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="1.5" opacity="0.25"/>
        <path d="M12 20l5.5 5.5L28 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
      </svg>
    ),
  };
  return (
    <div className="kds-empty-col" aria-label={message}>
      {icons[icon]}
      <span>{message}</span>
    </div>
  );
}
