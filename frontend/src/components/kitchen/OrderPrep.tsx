// ============================================================
// frontend/src/components/kitchen/OrderPrep.tsx  —  Fase 5
//
// Tarjeta de orden KDS con checkboxes por item.
// Optimizada para interacción táctil (botones ≥ 48px).
//
// LÓGICA DE ITEMS COMPLETADOS:
// - Los checkboxes son estado LOCAL del kitchenStore.
// - NO se envían al backend por item (la BD solo guarda status de orden).
// - Cuando TODOS los items están marcados, se habilita "Marcar listo".
//
// ACCIONES DISPONIBLES SEGÚN COLUMNA:
//   sent_to_kitchen  → "Aceptar orden" (→ in_preparation)
//   in_preparation   → checkboxes + "Marcar listo" (cuando todos ✓)
//   ready_for_pickup → solo lectura (confirmación visual)
//
// memo: evita re-render si order no cambió (comparación por referencia
// es suficiente porque kitchenStore siempre crea nuevo objeto al actualizar)
// ============================================================

import { memo, useCallback } from 'react';
import KDSTimer from './KDSTimer';
import { useKitchenStore } from '../../store/kitchenStore';
import type { KitchenOrder } from '../../store/kitchenStore';

interface Props {
  order:      KitchenOrder;
  onAccept:   (orderId: string) => void;  // sent_to_kitchen → in_preparation
  onReady:    (orderId: string) => void;  // in_preparation → ready_for_pickup
  disabled?:  boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  autoservicio: '📱 Autoservicio',
  waiter:       '👤 Mesero',
  kiosk:        '🖥️ Kiosk',
};

const OrderPrep = memo(function OrderPrep({
  order,
  onAccept,
  onReady,
  disabled,
}: Props) {
  const toggleItemCompleted = useKitchenStore((s) => s.toggleItemCompleted);

  const isSentToKitchen  = order.status === 'sent_to_kitchen';
  const isInPreparation  = order.status === 'in_preparation';
  const isReady          = order.status === 'ready_for_pickup';

  const handleToggle = useCallback(
    (itemId: string) => {
      if (!isInPreparation) return;
      toggleItemCompleted(order.id, itemId);
    },
    [order.id, isInPreparation, toggleItemCompleted]
  );

  // Precio: PostgreSQL retorna DECIMAL como string → parseFloat
  const total = parseFloat(order.total as unknown as string);

  return (
    <article
      className={`op-card ${isReady ? 'op-card--ready' : ''} ${isSentToKitchen ? 'op-card--new' : ''}`}
      aria-label={`Orden ${order.order_number}`}
    >
      {/* ── Header ── */}
      <header className="op-header">
        <div className="op-header-left">
          <h2 className="op-order-number">#{order.order_number}</h2>
          <KDSTimer createdAt={order.created_at} />
        </div>
        <div className="op-header-right">
          <span className="op-source">
            {SOURCE_LABEL[order.source] ?? order.source}
          </span>
          <span className="op-total">${total.toFixed(2)}</span>
        </div>
      </header>

      {/* ── Notas de la orden ── */}
      {order.notes && (
        <div className="op-order-notes" role="note">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 5h6M4 7.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {order.notes}
        </div>
      )}

      {/* ── Lista de items ── */}
      <ul className="op-items" role="list">
        {(order.items ?? []).map((item) => {
          const itemCompleted = order.completedItemIds.has(item.id);
          const itemPrice = parseFloat(item.price as unknown as string);

          return (
            <li key={item.id} className={`op-item ${itemCompleted ? 'op-item--done' : ''}`}>
              {/* Checkbox táctil (mín 48×48px por WCAG) */}
              <button
                type="button"
                className={`op-checkbox ${itemCompleted ? 'op-checkbox--checked' : ''}`}
                onClick={() => handleToggle(item.id)}
                disabled={!isInPreparation || disabled}
                aria-checked={itemCompleted}
                aria-label={`${itemCompleted ? 'Desmarcar' : 'Marcar'} ${item.name}`}
                role="checkbox"
              >
                {itemCompleted && (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M3 9l4 4 8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                  </svg>
                )}
              </button>

              {/* Info del item */}
              <div className="op-item-info">
                <span className="op-item-qty">{item.quantity}×</span>
                <span className="op-item-name">{item.name}</span>
                {item.special_instructions && (
                  <span className="op-item-notes">
                    — {item.special_instructions}
                  </span>
                )}
              </div>

              <span className="op-item-price">
                ${(itemPrice * item.quantity).toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>

      {/* ── Barra de progreso (solo in_preparation) ── */}
      {isInPreparation && (order.items?.length ?? 0) > 0 && (
        <div className="op-progress" role="progressbar"
          aria-valuenow={order.completedItemIds.size}
          aria-valuemax={order.items?.length ?? 0}
          aria-label="Progreso de preparación">
          <div className="op-progress-bar">
            <div
              className="op-progress-fill"
              style={{
                width: `${(order.completedItemIds.size / (order.items?.length ?? 1)) * 100}%`
              }}
            />
          </div>
          <span className="op-progress-text">
            {order.completedItemIds.size} / {order.items?.length ?? 0} items
          </span>
        </div>
      )}

      {/* ── Acciones ── */}
      <footer className="op-footer">
        {isSentToKitchen && (
          <button
            type="button"
            className="op-btn op-btn--accept"
            onClick={() => onAccept(order.id)}
            disabled={disabled}
            aria-label={`Aceptar orden ${order.order_number}`}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            Aceptar orden
          </button>
        )}

        {isInPreparation && (
          <button
            type="button"
            className={`op-btn op-btn--ready ${order.allItemsCompleted ? 'op-btn--ready-active' : ''}`}
            onClick={() => onReady(order.id)}
            disabled={!order.allItemsCompleted || disabled}
            aria-label={
              order.allItemsCompleted
                ? `Marcar orden ${order.order_number} como lista`
                : `Completa todos los items antes de marcar como listo`
            }
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M6 10l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {order.allItemsCompleted ? 'Marcar listo ✓' : `Faltan ${(order.items?.length ?? 0) - order.completedItemIds.size} items`}
          </button>
        )}

        {isReady && (
          <div className="op-ready-badge" role="status">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 10l4 4 8-8" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            Listo para entregar
          </div>
        )}
      </footer>
    </article>
  );
});

export default OrderPrep;
