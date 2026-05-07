// ============================================================
// frontend/src/components/kds/MiniInventoryPanel.tsx  —  F10
//
// Panel lateral del KDS que muestra el mini-inventario del turno
// activo del cocinero con barras de progreso por ingrediente.
// Se actualiza en tiempo real vía WebSocket.
// ============================================================

import { useEffect } from 'react';
import { useNavigate }     from 'react-router-dom';
import { useShiftStore }   from '../../store/shiftStore';
import { apiFetch }        from '../../services/api';
import type { ShiftWithdrawal } from '../../types/inventory';
import type { ShiftItem }       from '../../types/shift';

type MiniStatus = ShiftItem['mini_status'];

// ── Barra por ingrediente ─────────────────────────────────────
function IngredientBar({ item }: { item: ShiftItem }) {
  const pct = item.quantity_withdrawn > 0
    ? Math.max(0, Math.min(100, (item.quantity_remaining / item.quantity_withdrawn) * 100))
    : 0;

  const barColor: Record<MiniStatus, string> = {
    OK:      '#22c55e',
    BAJO:    '#f59e0b',
    CRITICO: '#ef4444',
    AGOTADO: '#6b7280',
  };
  const label: Record<MiniStatus, string> = {
    OK: '🟢', BAJO: '🟡', CRITICO: '🔴', AGOTADO: '⚫',
  };

  return (
    <div className="mip-item">
      <div className="mip-item-header">
        <span className="mip-item-name">
          {label[item.mini_status]} {item.ingredient_name}
        </span>
        <span className="mip-item-qty">
          {item.quantity_remaining.toFixed(2)} / {item.quantity_withdrawn.toFixed(2)} {item.unit}
        </span>
      </div>
      <div className="mip-bar-track">
        <div
          className="mip-bar-fill"
          style={{ width: `${pct}%`, background: barColor[item.mini_status] }}
        />
      </div>
      {(item.mini_status === 'CRITICO' || item.mini_status === 'AGOTADO') && (
        <p className="mip-alert-text">
          {item.mini_status === 'AGOTADO'
            ? '⚫ Agotado — ir a bodega'
            : `🔴 Crítico — ${pct.toFixed(0)}% restante`}
        </p>
      )}
    </div>
  );
}

// ── Panel principal ───────────────────────────────────────────
interface Props {
  onOpenRestock: () => void;
  onOpenClose:   () => void;
}

export default function MiniInventoryPanel({ onOpenRestock, onOpenClose }: Props) {
  const navigate = useNavigate();
  const {
    activeWithdrawal, items, loading, alertCount,
    setActiveWithdrawal, setItems, setLoading,
  } = useShiftStore();

  useEffect(() => {
    // Carga el turno activo y su mini-inventario
    setLoading(true);
    apiFetch<ShiftWithdrawal | null>('/inventory/withdrawals/active')
      .then((wd) => {
        setActiveWithdrawal(wd);
        if (wd) {
          return apiFetch<ShiftItem[]>(`/inventory/withdrawals/${wd.id}/items`);
        }
        return [];
      })
      .then(setItems)
      .catch(() => setItems([]));
  }, []); // eslint-disable-line

  if (loading) {
    return (
      <aside className="mini-inv-panel">
        <div className="mip-loading">
          <div className="mip-spinner" />
        </div>
      </aside>
    );
  }

  if (!activeWithdrawal) {
    return (
      <aside className="mini-inv-panel">
        <div className="mip-header">
          <h2 className="mip-title">🧺 Mini-inventario</h2>
        </div>
        <div className="mip-no-shift">
          <p>Sin turno activo</p>
          <button className="mip-btn-bodega" onClick={() => navigate('/cocina/bodega')}>
            Ir a bodega
          </button>
        </div>
      </aside>
    );
  }

  const startTime = new Date(activeWithdrawal.started_at).toLocaleTimeString('es', {
    hour: '2-digit', minute: '2-digit',
  });

  const okItems   = items.filter((i) => i.mini_status === 'OK').length;
  const lowItems  = items.filter((i) => i.mini_status === 'BAJO').length;

  return (
    <aside className="mini-inv-panel">
      {/* Header del panel */}
      <div className="mip-header">
        <div>
          <h2 className="mip-title">🧺 Mi turno</h2>
          <p className="mip-started">Iniciado a las {startTime}</p>
        </div>
        {alertCount > 0 && (
          <span className="mip-alert-badge">{alertCount}</span>
        )}
      </div>

      {/* Resumen rápido */}
      <div className="mip-summary">
        <span className="mip-sum-ok">✅ {okItems} OK</span>
        {lowItems > 0   && <span className="mip-sum-low">⚠️ {lowItems} bajo</span>}
        {alertCount > 0 && <span className="mip-sum-crit">🚨 {alertCount} crítico</span>}
      </div>

      {/* Lista de ingredientes */}
      <div className="mip-items-list">
        {items.length === 0 ? (
          <p className="mip-empty">Sin ingredientes en el turno</p>
        ) : (
          // Primero los críticos/agotados, luego el resto
          [...items]
            .sort((a, b) => {
              const order: Record<string, number> = { AGOTADO: 0, CRITICO: 1, BAJO: 2, OK: 3 };
              return (order[a.mini_status] ?? 4) - (order[b.mini_status] ?? 4);
            })
            .map((item) => <IngredientBar key={item.id} item={item} />)
        )}
      </div>

      {/* Acciones */}
      <div className="mip-actions">
        <button className="mip-btn-restock" onClick={onOpenRestock}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          Reabastecer
        </button>
        <button className="mip-btn-close" onClick={onOpenClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          Cerrar turno
        </button>
      </div>
    </aside>
  );
}