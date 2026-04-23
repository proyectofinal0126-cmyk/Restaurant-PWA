// ============================================================
// frontend/src/pages/mesero/TableDashboard.tsx
// Ruta: /mesero/dashboard
//
// Dashboard principal del mesero. Muestra todas las mesas
// del restaurante con su estado actual en tiempo real.
//
// LAYOUT:
//   - Header con stats rápidos (libres / ocupadas / listas)
//   - Filtro por sección (Salón, Terraza, Privado, etc.)
//   - Grid de tarjetas de mesa (TableCard)
//   - Modal de DeliveryConfirm al confirmar entrega
//
// TIEMPO REAL: useWaiterWebSocket escucha order:status y
// table:status para actualizar el grid sin recargar.
// ============================================================

import { useEffect, useState, useCallback, memo } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAppStore }         from '../../store/appStore';
import { useWaiterStore }      from '../../store/waiterStore';
import { useWaiterWebSocket }  from '../../hooks/useWaiterWebSocket';
import { getTables, updateTableStatus } from '../../services/waiterService';
import DeliveryConfirm         from '../../components/waiter/DeliveryConfirm';
import OrderStatus             from '../../components/waiter/OrderStatus';
import type { Table, TableStatus } from '../../types/table';
import '../../styles/mesero.css';

// ── Colores y labels de estado de mesa ──────────────────────
const TABLE_STATUS_CONFIG: Record<TableStatus, {
  label: string; cardClass: string; dotClass: string;
}> = {
  available:    { label: 'Libre',          cardClass: 'tc-available',    dotClass: 'dot-green'  },
  occupied:     { label: 'Ocupada',        cardClass: 'tc-occupied',     dotClass: 'dot-orange' },
  reserved:     { label: 'Reservada',      cardClass: 'tc-reserved',     dotClass: 'dot-blue'   },
  waiting_bill: { label: 'Esperando cuenta', cardClass: 'tc-waiting',   dotClass: 'dot-yellow' },
};

// ── Componente tarjeta de mesa ───────────────────────────────
interface TableCardProps {
  table:        Table;
  onTakeOrder:  (table: Table) => void;
  onDeliver:    (table: Table) => void;
  onFreeTable:  (table: Table) => void;
}

const TableCard = memo(function TableCard({
  table, onTakeOrder, onDeliver, onFreeTable,
}: TableCardProps) {
  const cfg         = TABLE_STATUS_CONFIG[table.status];
  const isAvailable = table.status === 'available';
  const isOccupied  = table.status === 'occupied';
  const isReady     = table.current_order_status === 'ready_for_pickup';

  // Tiempo en mesa
  const elapsed = table.order_created_at
    ? Math.floor((Date.now() - new Date(table.order_created_at).getTime()) / 60_000)
    : null;

  return (
    <article
      className={`table-card ${cfg.cardClass} ${isReady ? 'tc-ready-pulse' : ''}`}
      aria-label={`Mesa ${table.number}, estado: ${cfg.label}`}
    >
      {/* Cabecera de la tarjeta */}
      <div className="tc-header">
        <div className="tc-header-left">
          <span className={`tc-dot ${cfg.dotClass}`} aria-hidden="true" />
          <h2 className="tc-number">Mesa {table.number}</h2>
        </div>
        <span className="tc-status-label">{cfg.label}</span>
      </div>

      {/* Info de capacidad y sección */}
      <div className="tc-meta">
        <span className="tc-capacity" title="Capacidad">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="4.5" r="2.2" stroke="currentColor" strokeWidth="1.1"/>
            <path d="M2 11.5c0-2.49 2.01-4.5 4.5-4.5s4.5 2.01 4.5 4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          {table.capacity}
        </span>
        {table.section && (
          <span className="tc-section">{table.section}</span>
        )}
        {elapsed !== null && (
          <span className={`tc-elapsed ${elapsed > 45 ? 'tc-elapsed--warn' : ''}`}>
            {elapsed}m
          </span>
        )}
      </div>

      {/* Estado de la orden activa */}
      {table.current_order_id && (
        <div className="tc-order-info">
          <span className="tc-order-num">{table.current_order_number ?? '—'}</span>
          <OrderStatus status={table.current_order_status} />
        </div>
      )}

      {/* Mesero asignado */}
      {table.waiter_name && (
        <div className="tc-waiter">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1"/>
            <path d="M2 10c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          {table.waiter_name}
        </div>
      )}

      {/* Acciones */}
      <div className="tc-actions">
        {isAvailable && (
          <button
            type="button"
            className="tc-btn tc-btn-primary"
            onClick={() => onTakeOrder(table)}
            aria-label={`Tomar orden en mesa ${table.number}`}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Tomar orden
          </button>
        )}

        {isOccupied && isReady && (
          <button
            type="button"
            className="tc-btn tc-btn-success"
            onClick={() => onDeliver(table)}
            aria-label={`Entregar pedido en mesa ${table.number}`}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M2 7.5l4 4 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Entregar pedido
          </button>
        )}

        {isOccupied && !isReady && table.current_order_id && (
          <span className="tc-monitoring">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M6.5 3.5v3l2 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            En proceso
          </span>
        )}

        {table.status === 'waiting_bill' && (
          <button
            type="button"
            className="tc-btn tc-btn-ghost"
            onClick={() => onFreeTable(table)}
            aria-label={`Liberar mesa ${table.number}`}
          >
            Liberar mesa
          </button>
        )}
      </div>
    </article>
  );
});

// ── Dashboard principal ─────────────────────────────────────
export default function TableDashboard() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const token    = localStorage.getItem('rpwa-token');

  const {
    tables, loading, error,
    activeSection,
    setTables, setLoading, setError,
    setActiveSection, getSections, getFilteredTables,
    updateTableStatus: updateLocal,
  } = useWaiterStore();

  // Modal de entrega
  const [deliverModal, setDeliverModal] = useState<Table | null>(null);
  const [actionError,  setActionError]  = useState<string | null>(null);

  // ── Carga inicial ─────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getTables()
      .then(setTables)
      .catch((e: Error) => setError(e.message));
  }, []); // eslint-disable-line

  // ── WebSocket tiempo real ─────────────────────────────────
  useWaiterWebSocket(token);

  // ── Acción: ir a tomar orden ──────────────────────────────
  const handleTakeOrder = useCallback((table: Table) => {
    navigate(`/mesero/orden/${table.id}`);
  }, [navigate]);

  // ── Acción: confirmar entrega ─────────────────────────────
  const handleDeliverSuccess = useCallback(() => {
    setDeliverModal(null);
    // Refresca mesas para sincronizar estado
    getTables().then(setTables).catch(() => {});
  }, [setTables]);

  // ── Acción: liberar mesa (waiting_bill → available) ───────
  const handleFreeTable = useCallback(async (table: Table) => {
    setActionError(null);
    try {
      await updateTableStatus(table.id, 'available');
      updateLocal(table.id, 'available', {
        current_order_id:     null,
        current_order_number: null,
        current_order_status: null,
      });
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Error al liberar mesa');
    }
  }, [updateLocal]);

  // ── Estadísticas de cabecera ──────────────────────────────
  const stats = {
    available:    tables.filter((t) => t.status === 'available').length,
    occupied:     tables.filter((t) => t.status === 'occupied').length,
    waitingBill:  tables.filter((t) => t.status === 'waiting_bill').length,
    ready:        tables.filter((t) => t.current_order_status === 'ready_for_pickup').length,
  };

  const sections        = getSections();
  const filteredTables  = getFilteredTables();

  return (
    <div className="mesero-root">
      {/* ── Header ── */}
      <header className="mesero-header">
        <div className="mh-left">
          <div className="mesero-logo" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <rect x="2" y="10" width="22" height="13" rx="2" stroke="#3b82f6" strokeWidth="1.5"/>
              <path d="M2 14h22" stroke="#3b82f6" strokeWidth="1.5"/>
              <circle cx="8" cy="7" r="3" stroke="#3b82f6" strokeWidth="1.5"/>
              <path d="M17 7h5M17 4h5M17 10h5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="mesero-title">Mesas</h1>
            <p className="mesero-subtitle">{user?.name ?? 'Mesero'}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mh-stats">
          <div className="stat-chip chip-green">
            <span>{stats.available}</span> libres
          </div>
          <div className="stat-chip chip-orange">
            <span>{stats.occupied}</span> ocupadas
          </div>
          {stats.ready > 0 && (
            <div className="stat-chip chip-emerald">
              <span>{stats.ready}</span> listas 🎉
            </div>
          )}
          {stats.waitingBill > 0 && (
            <div className="stat-chip chip-yellow">
              <span>{stats.waitingBill}</span> cuenta
            </div>
          )}
        </div>

        <button
          type="button"
          className="mesero-exit-btn"
          onClick={() => navigate('/')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M10 11l4-4-4-4M14 7H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Salir
        </button>
      </header>

      {/* ── Error banner ── */}
      {(error || actionError) && (
        <div className="mesero-error" role="alert">
          {error ?? actionError}
          <button onClick={() => { setError(null); setActionError(null); }}>×</button>
        </div>
      )}

      {/* ── Filtro por sección ── */}
      {sections.length > 1 && (
        <nav className="section-tabs" aria-label="Filtrar por sección">
          <button
            type="button"
            className={`section-tab ${!activeSection ? 'section-tab--active' : ''}`}
            onClick={() => setActiveSection(null)}
          >
            Todas ({tables.length})
          </button>
          {sections.map((sec) => (
            <button
              key={sec}
              type="button"
              className={`section-tab ${activeSection === sec ? 'section-tab--active' : ''}`}
              onClick={() => setActiveSection(sec)}
            >
              {sec} ({tables.filter((t) => t.section === sec).length})
            </button>
          ))}
        </nav>
      )}

      {/* ── Grid de mesas ── */}
      {loading ? (
        <div className="mesero-loading" aria-busy="true">
          <div className="mesero-spinner" aria-hidden="true" />
          <p>Cargando mesas...</p>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="mesero-empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="6" y="18" width="36" height="22" rx="3" stroke="currentColor" strokeWidth="1.5" opacity="0.25"/>
            <path d="M6 24h36" stroke="currentColor" strokeWidth="1.5" opacity="0.25"/>
          </svg>
          <p>Sin mesas en esta sección</p>
        </div>
      ) : (
        <main className="tables-grid" aria-label="Mapa de mesas">
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onTakeOrder={handleTakeOrder}
              onDeliver={(t) => setDeliverModal(t)}
              onFreeTable={handleFreeTable}
            />
          ))}
        </main>
      )}

      {/* ── Modal de entrega ── */}
      {deliverModal && deliverModal.current_order_id && (
        <DeliveryConfirm
          orderId={deliverModal.current_order_id}
          orderNumber={deliverModal.current_order_number ?? '—'}
          tableNumber={deliverModal.number}
          onSuccess={handleDeliverSuccess}
          onCancel={() => setDeliverModal(null)}
        />
      )}
    </div>
  );
}