// ============================================================
// frontend/src/pages/cashier/CajaMesero.tsx
// FIX 4: Agrega botón "Historial de pedidos" en el header.
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { useNavigate }          from 'react-router-dom';
import { useAppStore }          from '../../store/appStore';
import { useCashierStore }      from '../../store/cashierStore';
import { useCashierWebSocket }  from '../../hooks/useCashierWebSocket';
import { getWaitingTables }     from '../../services/cashierService';
import BillGenerator            from '../../components/cashier/BillGenerator';
import PaymentMethod            from '../../components/cashier/PaymentMethod';
import TableRelease             from '../../components/cashier/TableRelease';
import OrderHistory             from '../../components/shared/OrderHistory';   // FIX 4
import type { WaitingTable }    from '../../types/cashier';
import type { PayOrderResponse } from '../../types/cashier';
import '../../styles/cajamesero.css';
import '../../styles/orderhistory.css';  // FIX 4

type FlowStep = 'none' | 'bill' | 'payment' | 'release';

function serviceDuration(createdAt: string): string {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function CajaMesero() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const token    = localStorage.getItem('rpwa-token');

  const {
    waitingTables, loading, error,
    setWaitingTables, setLoading, setError,
    selectTable, resetFlow,
  } = useCashierStore();

  const [flowStep,    setFlowStep]    = useState<FlowStep>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);   // FIX 4

  const loadTables = useCallback(() => {
    setLoading(true);
    getWaitingTables()
      .then(setWaitingTables)
      .catch((e: Error) => setError(e.message));
  }, [setLoading, setWaitingTables, setError]);

  useEffect(() => { loadTables(); }, []); // eslint-disable-line

  useCashierWebSocket(token);

  const handleViewBill = useCallback((table: WaitingTable) => {
    selectTable(table);
    setFlowStep('bill');
  }, [selectTable]);

  const filteredTables = searchQuery.trim()
    ? waitingTables.filter((t) =>
        String(t.tableNumber).includes(searchQuery) ||
        t.section?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : waitingTables;

  return (
    <div className="cajam-root">
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
          <span className="cajam-count-pill">
            {waitingTables.length} {waitingTables.length === 1 ? 'mesa' : 'mesas'} esperando
          </span>
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

      <div className="cajam-search-bar">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <input
          type="search"
          className="cajam-search"
          placeholder="Buscar por número de mesa o sección..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <main className="cajam-body">
        {loading ? (
          <div className="cajam-loading">
            <div className="cashier-spinner" />
            <p>Cargando mesas...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="cajam-empty">
            <p>{searchQuery ? 'Sin resultados' : 'No hay mesas esperando cuenta'}</p>
            {!searchQuery && <span>Las mesas aparecen aquí cuando el mesero solicita la cuenta</span>}
          </div>
        ) : (
          <div className="cajam-table">
            <div className="cajam-table-head">
              <span>Mesa</span>
              <span>Sección</span>
              <span>Mesero</span>
              <span>Tiempo de servicio</span>
              <span className="col-right">Total est.</span>
              <span className="col-right">Acción</span>
            </div>
            {filteredTables.map((table) => (
              <div key={table.tableId} className="cajam-table-row">
                <span className="cajam-mesa-num"><span className="mesa-badge">Mesa {table.tableNumber}</span></span>
                <span className="cajam-section">{table.section ?? '—'}</span>
                <span className="cajam-waiter">{table.waiterName ?? '—'}</span>
                <span className="cajam-duration">{serviceDuration(table.createdAt)}</span>
                <span className="cajam-total col-right">${parseFloat(table.total as unknown as string).toFixed(2)}</span>
                <span className="cajam-action col-right">
                  <button type="button" className="cajam-view-btn" onClick={() => handleViewBill(table)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7c0 0 2-4 5-4s5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" strokeWidth="1.2"/>
                      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    </svg>
                    Ver cuenta
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

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

      {/* FIX 4: Modal de historial */}
      {showHistory && (
        <OrderHistory onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}