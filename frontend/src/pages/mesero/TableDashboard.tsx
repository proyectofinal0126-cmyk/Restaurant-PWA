// ============================================================
// frontend/src/pages/mesero/TableDashboard.tsx
// Ruta: /mesero/dashboard
//
// FLUJO ACTUALIZADO:
//   1. Mesa libre → "Tomar orden"
//   2. Mesa ocupada + orden en proceso → badge estado (En cocina / Preparando / Listo)
//   3. Mesa ocupada + orden ready_for_pickup → "Entregar pedido"
//   4. Mesa ocupada + orden delivered → "Pedir cuenta" (cliente solicitó pagar)
//      → BillRequestModal (método de pago + propina) → PATCH /request-bill
//      → mesa pasa a waiting_bill → CAJA gestiona el cobro y LIBERA la mesa
//   5. Mesa waiting_bill → solo informativo para el mesero ("Esperando cobro")
//      → El mesero NO puede liberar la mesa; solo CAJA puede hacerlo al cobrar
// ============================================================

import { useEffect, useState, useCallback, memo } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAppStore }         from '../../store/appStore';
import { useWaiterStore }      from '../../store/waiterStore';
import { useWaiterWebSocket }  from '../../hooks/useWaiterWebSocket';
import { getTables }           from '../../services/waiterService';
import DeliveryConfirm         from '../../components/waiter/DeliveryConfirm';
import BillRequestModal        from '../../components/waiter/BillRequestModal';
import OrderStatus             from '../../components/waiter/OrderStatus';
import OrderDetailModal        from '../../components/waiter/OrderDetailModal';
import type { Table, TableStatus } from '../../types/table';
import '../../styles/mesero.css';

// ── Colores y labels de estado de mesa ──────────────────────
const TABLE_STATUS_CONFIG: Record<TableStatus, {
  label: string; cardClass: string; dotClass: string;
}> = {
  available:    { label: 'Libre',             cardClass: 'tc-available', dotClass: 'dot-green'  },
  occupied:     { label: 'Ocupada',           cardClass: 'tc-occupied',  dotClass: 'dot-orange' },
  reserved:     { label: 'Reservada',         cardClass: 'tc-reserved',  dotClass: 'dot-blue'   },
  waiting_bill: { label: 'Esperando cobro',   cardClass: 'tc-waiting',   dotClass: 'dot-yellow' },
};

// ── Componente tarjeta de mesa ───────────────────────────────
interface TableCardProps {
  table:         Table;
  onTakeOrder:   (table: Table) => void;
  onDeliver:     (table: Table) => void;
  onRequestBill: (table: Table) => void;
  onViewDetail:  (table: Table) => void;
}

const TableCard = memo(function TableCard({
  table, onTakeOrder, onDeliver, onRequestBill, onViewDetail,
}: TableCardProps) {
  const cfg          = TABLE_STATUS_CONFIG[table.status];
  const isAvailable  = table.status === 'available';
  const isOccupied   = table.status === 'occupied';
  const isWaiting    = table.status === 'waiting_bill';
  const isReady      = table.current_order_status === 'ready_for_pickup';
  const isDelivered  = table.current_order_status === 'delivered';

  const elapsed = table.order_created_at
    ? Math.floor((Date.now() - new Date(table.order_created_at).getTime()) / 60_000)
    : null;

  return (
    <article
      className={`table-card ${cfg.cardClass} ${isReady ? 'tc-ready-pulse' : ''}`}
      aria-label={`Mesa ${table.number}, estado: ${cfg.label}`}
    >
      {/* Cabecera */}
      <div className="tc-header">
        <div className="tc-header-left">
          <span className={`tc-dot ${cfg.dotClass}`} aria-hidden="true" />
          <h2 className="tc-number">Mesa {table.number}</h2>
        </div>
        <span className="tc-status-label">{cfg.label}</span>
      </div>

      {/* Meta */}
      <div className="tc-meta">
        <span className="tc-capacity" title="Capacidad">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="4.5" r="2.2" stroke="currentColor" strokeWidth="1.1"/>
            <path d="M2 11.5c0-2.49 2.01-4.5 4.5-4.5s4.5 2.01 4.5 4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          {table.capacity}
        </span>
        {table.section && <span className="tc-section">{table.section}</span>}
        {elapsed !== null && (
          <span className={`tc-elapsed ${elapsed > 45 ? 'tc-elapsed--warn' : ''}`}>
            {elapsed}m
          </span>
        )}
      </div>

      {/* Estado de la orden */}
      {table.current_order_id && (
        <div className="tc-order-info">
          <span className="tc-order-num">{table.current_order_number ?? '—'}</span>
          <OrderStatus status={table.current_order_status} />
          <button
            type="button"
            className="tc-btn-detail"
            onClick={() => onViewDetail(table)}
            aria-label={`Ver detalle del pedido en mesa ${table.number}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="2.5" width="10" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M3.5 5.5h5M3.5 7.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            Ver pedido
          </button>
        </div>
      )}

      {/* Mesero */}
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

        {/* Mesa libre → tomar orden */}
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

        {/* Orden lista para entregar */}
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

        {/* Orden entregada → cliente puede pedir cuenta */}
        {isOccupied && isDelivered && (
          <button
            type="button"
            className="tc-btn tc-btn-bill"
            onClick={() => onRequestBill(table)}
            aria-label={`Solicitar cuenta mesa ${table.number}`}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="2" y="3" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5 7h5M5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Pedir cuenta
          </button>
        )}

        {/* Orden en proceso (cocina) → solo info */}
        {isOccupied && !isReady && !isDelivered && table.current_order_id && (
          <span className="tc-monitoring">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M6.5 3.5v3l2 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            En proceso
          </span>
        )}

        {/* Mesa en waiting_bill → esperando que CAJA cobre y libere */}
        {isWaiting && (
          <div className="tc-waiting-info">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1.5" y="4" width="11" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 4V3a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>Cuenta enviada — esperando cobro de caja</span>
          </div>
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
  } = useWaiterStore();

  const [deliverModal,     setDeliverModal]     = useState<Table | null>(null);
  const [billModal,        setBillModal]         = useState<Table | null>(null);
  const [detailModal,      setDetailModal]       = useState<Table | null>(null);

  // Carga inicial
  useEffect(() => {
    setLoading(true);
    getTables()
      .then(setTables)
      .catch((e: Error) => setError(e.message));
  }, []); // eslint-disable-line

  // WebSocket tiempo real
  useWaiterWebSocket(token);

  const handleTakeOrder = useCallback((table: Table) => {
    navigate(`/mesero/orden/${table.id}`);
  }, [navigate]);

  // Entrega exitosa → refrescar mesas
  const handleDeliverSuccess = useCallback(() => {
    setDeliverModal(null);
    getTables().then(setTables).catch(() => {});
  }, [setTables]);

  // Ver detalle de pedido
  const handleViewDetail = useCallback((table: Table) => {
    setDetailModal(table);
  }, []);

  // Cuenta solicitada exitosamente → refrescar mesas
  const handleBillSuccess = useCallback(() => {
    setBillModal(null);
    getTables().then(setTables).catch(() => {});
  }, [setTables]);

  // Stats
  const stats = {
    available:   tables.filter((t) => t.status === 'available').length,
    occupied:    tables.filter((t) => t.status === 'occupied').length,
    waitingBill: tables.filter((t) => t.status === 'waiting_bill').length,
    ready:       tables.filter((t) => t.current_order_status === 'ready_for_pickup').length,
  };

  const sections       = getSections();
  const filteredTables = getFilteredTables();

  return (
    <div className="mesero-root">
      {/* Header */}
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
              <span>{stats.waitingBill}</span> en caja
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

      {/* Error banner */}
      {error && (
        <div className="mesero-error" role="alert">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Filtro por sección */}
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

      {/* Grid de mesas */}
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
              onRequestBill={(t) => setBillModal(t)}
              onViewDetail={handleViewDetail}
            />
          ))}
        </main>
      )}

      {/* Modal de entrega */}
      {deliverModal && deliverModal.current_order_id && (
        <DeliveryConfirm
          orderId={deliverModal.current_order_id}
          orderNumber={deliverModal.current_order_number ?? '—'}
          tableNumber={deliverModal.number}
          onSuccess={handleDeliverSuccess}
          onCancel={() => setDeliverModal(null)}
        />
      )}

      {/* Modal de detalle del pedido */}
      {detailModal && detailModal.current_order_id && (
        <OrderDetailModal
          orderId={detailModal.current_order_id}
          orderNumber={detailModal.current_order_number ?? '—'}
          tableNumber={detailModal.number}
          onClose={() => setDetailModal(null)}
        />
      )}

      {/* Modal de solicitar cuenta — BillRequestModal carga el detalle internamente */}
      {billModal && billModal.current_order_id && (
        <BillRequestModal
          orderId={billModal.current_order_id}
          orderNumber={billModal.current_order_number ?? '—'}
          tableNumber={billModal.number}
          onSuccess={handleBillSuccess}
          onCancel={() => setBillModal(null)}
        />
      )}
    </div>
  );
}
