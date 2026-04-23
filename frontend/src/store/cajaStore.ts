// ============================================================
// frontend/src/store/cajaStore.ts  —  Fase 4
//
// Estado en memoria del dashboard de Caja.
// Se puebla desde /api/orders/active al cargar y se actualiza
// en tiempo real vía WebSocket (useCajaWebSocket).
// NO persiste en localStorage — siempre fresco desde backend.
// ============================================================

import { create } from 'zustand';
//import type { Order, OrderStatus } from '../types/order';
import type { OrderWithMeta } from '../types/caja';

interface CajaState {
    orders: OrderWithMeta[];
    loading: boolean;
    error: string | null;
    newOrderAlert: boolean;  // activa sonido/visual de nueva orden

    setOrders: (orders: OrderWithMeta[]) => void;
    addOrder: (order: OrderWithMeta) => void;
    updateStatus: (id: string, status: string) => void;
    removeOrder: (id: string) => void;
    setLoading: (v: boolean) => void;
    setError: (msg: string | null) => void;
    clearAlert: () => void;
}

function withMeta(order: OrderWithMeta): OrderWithMeta {
    const created = new Date(order.created_at).getTime();
    const elapsed = Math.floor((Date.now() - created) / 60000);
    return { ...order, elapsedMinutes: elapsed, isUrgent: elapsed > 20 };
}

export const useCajaStore = create<CajaState>((set) => ({
    orders: [],
    loading: false,
    error: null,
    newOrderAlert: false,

    setOrders: (orders) => set({ orders: orders.map(withMeta), loading: false }),
    setLoading: (v) => set({ loading: v }),
    setError: (msg) => set({ error: msg, loading: false }),

    addOrder: (order) => set((s) => ({
        orders: [...s.orders, withMeta(order)],
        newOrderAlert: true,
    })),

    updateStatus: (id, status) => set((s) => ({
        orders: s.orders.map((o) =>
            o.id === id ? withMeta({ ...o, status: status as OrderWithMeta['status'] }) : o
        ),
    })),

    // Quitar del dashboard al completarse o cancelarse
    removeOrder: (id) => set((s) => ({
        orders: s.orders.filter((o) => o.id !== id),
    })),

  clearAlert: () => set({ newOrderAlert: false }),
}));