import { formatCOP } from '../../utils/constants';
// ============================================================
// frontend/src/pages/cashier/CajaMesero.tsx
//
// FLUJO ACTUALIZADO:
//   PANEL MONITOR (izquierda):
//     Caja ve TODAS las órdenes del mesero desde que salen a cocina.
//     Solo lectura: En cocina → Preparando → Listo → Entregado.
//     Muestra el estado en tiempo real vía WebSocket.
//
//   PANEL COBRO (derecha / pestaña):
//     Aparecen solo las mesas en waiting_bill (mesero solicitó cuenta).
//     Caja cobra y LIBERA la mesa al terminar. El mesero no puede liberar.
//
// La liberación de la mesa la hace SOLO caja al completar el pago.
// ============================================================

import { useState, useCallback }    from 'react';
import { useNavigate }              from 'react-router-dom';
import { useAppStore }              from '../../store/appStore';
import { useCashierStore }          from '../../store/cashierStore';
import { useCashierWebSocket }      from '../../hooks/useCashierWebSocket';
import { getWaitingTables }         from '../../services/cashierService';
import BillGenerator                from '../../components/cashier/BillGenerator';
import PaymentMethod                from '../../components/cashier/PaymentMethod';
import TableRelease                 from '../../components/cashier/TableRelease';
import OrderHistory                 from '../../components/shared/OrderHistory';
import type { WaitingTable }        from '../../types/cashier';
import type { MonitorOrder }        from '../../types/cashier';
import type { PayOrderResponse }    from '../../types/cashier';
import '../../styles/cajamesero.css';
import '../../styles/orderhistory.css';

type FlowStep = 'none' | 'bill' | 'payment' | 'release';
type ActivePanel = 'monitor' | 'cobro';

// ── Iconos SVG por estado ───────────────────────────────────
const STATUS_ICONS: Record<string, React.ReactNode> = {
  sent_to_kitchen: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 11V6a4.5 4.5 0 019 0v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M1 11h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M6.5 3V1.5M4.5 3.8L3.5 2.8M8.5 3.8L9.5 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  in_preparation: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M6.5 4v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  ready_for_pickup: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4 6.5l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  delivered: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M1.5 9.5l2-2 2 2 4-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.5 4.5l-4 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  waiting_bill: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="2" y="1.5" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4.5 4.5h4M4.5 6.5h4M4.5 8.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  completed: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 7l3 3 6-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
};

const ICON_WAITER = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M1.5 10.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

// ── Labels por estado ───────────────────────────────────────
const ORDER_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  sent_to_kitchen:  { label: 'En cocina',   cls: 'ms-kitchen'   },
  in_preparation:   { label: 'Preparando',  cls: 'ms-preparing' },
  ready_for_pickup: { label: 'Listo',       cls: 'ms-ready'     },
  delivered:        { label: 'Entregado',   cls: 'ms-delivered' },
  waiting_bill:     { label: 'Pide cuenta', cls: 'ms-bill'      },
  completed:        { label: 'Completado',  cls: 'ms-done'      },
};

function serviceDuration(createdAt: string): string {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ── Tarjeta del panel monitor ───────────────────────────────
function MonitorCard({ order }: { order: MonitorOrder }) {
  const [expanded, setExpanded] = useState(false);
  const st = ORDER_STATUS_LABELS[order.status] ?? { label: order.status, cls: '' };

  return (
    <div className={`mc-card ${st.cls}`}>
      <div className="mc-header" onClick={() => setExpanded((v) => !v)}>
        <div className="mc-left">
          <span className="mc-order-num">{order.orderNumber}</span>
          {order.tableNumber && (
            <span className="mc-table">Mesa {order.tableNumber}</span>
          )}
        </div>
        <div className="mc-right">
          <span className={`mc-badge ${st.cls}`}>
            {STATUS_ICONS[order.status]}
            {st.label}
          </span>
          <span className="mc-time">{serviceDuration(order.createdAt)}</span>
          <span className="mc-expand">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              {expanded
                ? <path d="M2 7.5l3.5-3.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                : <path d="M2 3.5l3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              }
            </svg>
          </span>
        </div>
      </div>
      {expanded && (
        <div className="mc-body">
          {/* Mesero */}
          {order.waiterName && (
            <p className="mc-waiter">
              {ICON_WAITER}
              {order.waiterName}
            </p>
          )}

          {/* Items */}
          {order.items.length > 0 && (
            <ul className="mc-items">
              {order.items.map((it, i) => (
                <li key={i} className="mc-item">
                  <span>{it.quantity}× {it.name}</span>
                  {it.notes && <span className="mc-item-note">{it.notes}</span>}
                </li>
              ))}
            </ul>
          )}

          {/* Desglose de totales */}
          <div className="mc-breakdown">
            <span className="mc-breakdown-row">
              <span>Subtotal</span>
              <span>{formatCOP(parseFloat(String(order.subtotal)))}</span>
            </span>
            {parseFloat(String(order.tax)) > 0 && (
              <span className="mc-breakdown-row">
                <span>Impuesto</span>
                <span>{formatCOP(parseFloat(String(order.tax)))}</span>
              </span>
            )}
            {parseFloat(String(order.tip)) > 0 && (
              <span className="mc-breakdown-row">
                <span>Propina</span>
                <span>{formatCOP(parseFloat(String(order.tip)))}</span>
              </span>
            )}
          </div>

          <div className="mc-footer-row">
            {/* Método de pago (cuando el mesero ya lo registró) */}
            {order.paymentMethod && (
              <span className="mc-method-chip">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <rect x="1" y="2.5" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M1 5h9" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
                {{
                  efectivo:        'Efectivo',
                  tarjeta_debito:  'Débito',
                  tarjeta_credito: 'Crédito',
                  transferencia:   'Transferencia',
                  tarjeta:         'Tarjeta',
                }[order.paymentMethod] ?? order.paymentMethod}
              </span>
            )}
            <div className="mc-total">
              Total: <strong>{formatCOP(parseFloat(String(order.total)))}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dashboard principal ─────────────────────────────────────
export default function CajaMesero() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const token    = localStorage.getItem('rpwa-token');

  const {
    monitorOrders,
    waitingTables, loading, error,
    setWaitingTables, setLoading, setError,
    selectTable, resetFlow,
  } = useCashierStore();

  const [flowStep,     setFlowStep]     = useState<FlowStep>('none');
  const [activePanel,  setActivePanel]  = useState<ActivePanel>('monitor');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showHistory,  setShowHistory]  = useState(false);

  const loadTables = useCallback(() => {
    setLoading(true);
    getWaitingTables()
      .then(setWaitingTables)
      .catch((e: Error) => setError(e.message));
  }, [setLoading, setWaitingTables, setError]);

  // WebSocket: carga inicial + suscripción a eventos
  useCashierWebSocket(token);

  const handleViewBill = useCallback((table: WaitingTable) => {
    selectTable(table);
    setFlowStep('bill');
  }, [selectTable]);

  const filteredWaiting = searchQuery.trim()
    ? waitingTables.filter((t) =>
        String(t.tableNumber).includes(searchQuery) ||
        t.section?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : waitingTables;

  // Órdenes del monitor excluyen las ya completadas o canceladas
  const activeMonitor = monitorOrders.filter(
    (o) => !['completed', 'cancelled'].includes(o.status)
  );

  return (
    <div className="cajam-root">

      {/* Header */}
      <header className="cajam-header">
        <div className="cajam-header-left">
          <div className="cajam-logo" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <rect x="2" y="6" width="22" height="16" rx="2" stroke="#22c55e" strokeWidth="1.5"/>
              <path d="M2 11h22M8 16h2M16 16h2" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9 3l4-2 4 2" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="cajam-title">Caja — Con Mesero</h1>
            <p className="cajam-subtitle">{user?.name ?? 'Cajero'}</p>
          </div>
        </div>

        <div className="cajam-header-right">
          {waitingTables.length > 0 && (
            <span className="cajam-count-pill cajam-count-urgent">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="2" y="1.5" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4.5 4.5h4M4.5 6.5h4M4.5 8.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {waitingTables.length} {waitingTables.length === 1 ? 'cuenta' : 'cuentas'} pendiente{waitingTables.length > 1 ? 's' : ''}
            </span>
          )}
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
          <button type="button" className="cajam-refresh-btn" onClick={loadTables} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
              style={loading ? { animation: 'cajaSpin 0.8s linear infinite' } : undefined}>
              <path d="M13.5 8A5.5 5.5 0 112.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M13.5 4v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button type="button" className="cajam-exit-btn" onClick={() => navigate('/')}>Salir</button>
        </div>
      </header>

      {error && (
        <div className="cajam-error" role="alert">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Pestañas de panel */}
      <div className="cajam-tabs">
        <button
          type="button"
          className={`cajam-tab ${activePanel === 'monitor' ? 'cajam-tab--active' : ''}`}
          onClick={() => setActivePanel('monitor')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 13h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Monitor de órdenes
          {activeMonitor.length > 0 && (
            <span className="cajam-tab-badge">{activeMonitor.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`cajam-tab ${activePanel === 'cobro' ? 'cajam-tab--active' : ''}`}
          onClick={() => setActivePanel('cobro')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4.5 5h5M4.5 7.5h5M4.5 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Cobro de cuentas
          {waitingTables.length > 0 && (
            <span className="cajam-tab-badge cajam-tab-badge--urgent">{waitingTables.length}</span>
          )}
        </button>
      </div>

      <main className="cajam-body">

        {/* ── PANEL MONITOR ── */}
        {activePanel === 'monitor' && (
          <div className="cajam-monitor">
            {activeMonitor.length === 0 ? (
              <div className="cajam-empty">
                <p>Sin órdenes activas del mesero</p>
                <span>Las órdenes aparecen aquí desde que se envían a cocina</span>
              </div>
            ) : (
              <div className="cajam-monitor-grid">
                {activeMonitor.map((order) => (
                  <MonitorCard key={order.orderId} order={order} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PANEL COBRO ── */}
        {activePanel === 'cobro' && (
          <div className="cajam-cobro">
            <div className="cajam-search-bar">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                type="search"
                className="cajam-search"
                placeholder="Buscar por mesa o sección..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="cajam-loading">
                <div className="cashier-spinner" />
                <p>Cargando mesas...</p>
              </div>
            ) : filteredWaiting.length === 0 ? (
              <div className="cajam-empty">
                <p>{searchQuery ? 'Sin resultados' : 'No hay cuentas pendientes'}</p>
                {!searchQuery && (
                  <span>Las mesas aparecen aquí cuando el mesero solicita la cuenta</span>
                )}
              </div>
            ) : (
              <div className="cajam-table">
                <div className="cajam-table-head">
                  <span>Mesa</span>
                  <span>Sección</span>
                  <span>Mesero</span>
                  <span>Duración</span>
                  <span>Método</span>
                  <span className="col-right">Total</span>
                  <span className="col-right">Acción</span>
                </div>
                {filteredWaiting.map((table) => (
                  <div key={table.tableId} className="cajam-table-row">
                    <span className="cajam-mesa-num">
                      <span className="mesa-badge">Mesa {table.tableNumber}</span>
                    </span>
                    <span className="cajam-section">{table.section ?? '—'}</span>
                    <span className="cajam-waiter">{table.waiterName ?? '—'}</span>
                    <span className="cajam-duration">{serviceDuration(table.createdAt)}</span>
                    <span className="cajam-method">
                      {table.paymentMethod ? (
                        <span className="cajam-method-badge">
                          {table.paymentMethod === 'efectivo'        ? 'Efectivo'      :
                           table.paymentMethod === 'tarjeta_debito'  ? 'Débito'        :
                           table.paymentMethod === 'tarjeta_credito' ? 'Crédito'       :
                           table.paymentMethod === 'transferencia'   ? 'Transf.'       :
                           table.paymentMethod}
                        </span>
                      ) : '—'}
                    </span>
                    <span className="cajam-total col-right">
                      {formatCOP(parseFloat(String(table.total)))}
                    </span>
                    <span className="cajam-action col-right">
                      <button
                        type="button"
                        className="cajam-view-btn"
                        onClick={() => handleViewBill(table)}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 7c0 0 2-4 5-4s5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" strokeWidth="1.2"/>
                          <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                        </svg>
                        Cobrar
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Flujo de cobro */}
      {flowStep === 'bill' && (
        <BillGenerator
          onProceedToPayment={() => setFlowStep('payment')}
          onClose={() => { setFlowStep('none'); resetFlow(); }}
        />
      )}
      {flowStep === 'payment' && (
        <PaymentMethod
          onSuccess={(_result: PayOrderResponse) => setFlowStep('release')}
          onBack={() => setFlowStep('bill')}
          onClose={() => { setFlowStep('none'); resetFlow(); }}
        />
      )}
      {flowStep === 'release' && (
        <TableRelease
          onReleased={() => { setFlowStep('none'); loadTables(); }}
          onClose={() => { setFlowStep('none'); resetFlow(); }}
        />
      )}

      {showHistory && (
        <OrderHistory onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}
