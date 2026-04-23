// ============================================================
// frontend/src/store/kitchenStore.ts  —  Fase 5: KDS
//
// Estado en memoria del Kitchen Display System.
// SIN persistencia (zustand/persist) — siempre se carga fresco
// desde /api/orders/active al montar el KDS.
//
// ARQUITECTURA DE ITEMS COMPLETADOS:
// La BD no tiene campo "item completado por cocina" (solo status
// de la orden completa). Por eso, el tracking de checkboxes
// de items es LOCAL al store, no va al backend.
// Solo el status final de la orden (in_preparation, ready_for_pickup)
// se persiste en la BD via PATCH /api/orders/:id/status.
//
// Reutiliza los tipos existentes de types/order.ts — NO crea nuevos.
// ============================================================

import { create } from 'zustand';
import type { Order, OrderStatus } from '../types/order';

// ── Tipos del módulo KDS ─────────────────────────────────────

/** Orden enriquecida con metadatos de cocina (solo en cliente) */
export interface KitchenOrder extends Order {
  /** IDs de items marcados como preparados por el cocinero (estado local) */
  completedItemIds: Set<string>;
  /** true si todos los items fueron marcados */
  allItemsCompleted: boolean;
}

/** Columnas del KDS */
export type KDSColumn = 'nuevas' | 'en_preparacion' | 'listas';

/** Mapeo columna → estados de orden */
export const KDS_COLUMN_STATUSES: Record<KDSColumn, OrderStatus[]> = {
  nuevas:         ['sent_to_kitchen'],
  en_preparacion: ['in_preparation'],
  listas:         ['ready_for_pickup'],
};

// ── Interfaz del store ───────────────────────────────────────

interface KitchenState {
  orders:        KitchenOrder[];
  loading:       boolean;
  error:         string | null;
  /** Flag que dispara alerta sonora de nueva orden */
  newOrderAlert: boolean;

  // ── Acciones de sincronización con backend ──
  /** Carga inicial desde /api/orders/active */
  setOrders:    (orders: Order[]) => void;
  /** Nueva orden llega por WebSocket */
  addOrder:     (order: Order)    => void;
  /** Actualiza status de una orden (desde WS o acción propia) */
  updateStatus: (orderId: string, status: OrderStatus) => void;
  /** Elimina la orden del KDS (completada/cancelada) */
  removeOrder:  (orderId: string) => void;

  // ── Acciones de UI local (checkboxes) ──
  /** Alterna el estado completado de un item en la orden */
  toggleItemCompleted: (orderId: string, itemId: string) => void;
  /** Resetea todos los checkboxes de una orden (al aceptarla) */
  resetItemsCompleted: (orderId: string) => void;

  // ── Acciones de estado ──
  setLoading:   (v: boolean)         => void;
  setError:     (msg: string | null) => void;
  clearAlert:   ()                   => void;
}

// ── Helpers ──────────────────────────────────────────────────

function toKitchenOrder(order: Order): KitchenOrder {
  return {
    ...order,
    completedItemIds:   new Set<string>(),
    allItemsCompleted:  false,
  };
}

function recalcCompleted(order: KitchenOrder): KitchenOrder {
  const total = order.items?.length ?? 0;
  const done  = order.completedItemIds.size;
  return {
    ...order,
    allItemsCompleted: total > 0 && done >= total,
  };
}

// ── Store ────────────────────────────────────────────────────

export const useKitchenStore = create<KitchenState>()((set) => ({
  orders:        [],
  loading:       false,
  error:         null,
  newOrderAlert: false,

  // Carga inicial: convierte Order[] → KitchenOrder[]
  setOrders: (orders) =>
    set({
      orders:  orders.map(toKitchenOrder),
      loading: false,
      error:   null,
    }),

  // Nueva orden por WS — dispara alerta sonora
  addOrder: (order) =>
    set((s) => ({
      orders:        [toKitchenOrder(order), ...s.orders],
      newOrderAlert: true,
    })),

  // Actualiza status; elimina si es terminal
  updateStatus: (orderId, status) =>
    set((s) => {
      if (['completed', 'cancelled'].includes(status)) {
        return { orders: s.orders.filter((o) => o.id !== orderId) };
      }
      return {
        orders: s.orders.map((o) =>
          o.id === orderId ? recalcCompleted({ ...o, status }) : o
        ),
      };
    }),

  removeOrder: (orderId) =>
    set((s) => ({ orders: s.orders.filter((o) => o.id !== orderId) })),

  // Toggle checkbox de item
  toggleItemCompleted: (orderId, itemId) =>
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        const next = new Set(o.completedItemIds);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        return recalcCompleted({ ...o, completedItemIds: next });
      }),
    })),

  // Resetea checkboxes (al enviar la orden a cocina)
  resetItemsCompleted: (orderId) =>
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? recalcCompleted({ ...o, completedItemIds: new Set<string>() })
          : o
      ),
    })),

  setLoading: (loading) => set({ loading }),
  setError:   (error)   => set({ error, loading: false }),
  clearAlert: ()        => set({ newOrderAlert: false }),
}));