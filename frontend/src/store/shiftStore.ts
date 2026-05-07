// ============================================================
// frontend/src/store/shiftStore.ts  —  Fase 10
//
// Estado del mini-inventario del turno activo del cocinero.
// Se actualiza en tiempo real vía WebSocket (inventory:stock_update).
// No persiste entre sesiones — siempre se carga fresco del backend.
// ============================================================

import { create } from 'zustand';
import type { ShiftItem, MiniStatus } from '../types/shift';
import type { ShiftWithdrawal } from '../types/inventory';

interface ShiftState {
  // Turno activo del cocinero
  activeWithdrawal: ShiftWithdrawal | null;
  // Items del mini-inventario (stock por ingrediente)
  items:            ShiftItem[];
  loading:          boolean;
  error:            string | null;
  // Conteo de alertas activas para el badge en el KDS
  alertCount:       number;

  // ── Acciones ──────────────────────────────────────────────
  setActiveWithdrawal: (wd: ShiftWithdrawal | null) => void;
  setItems:            (items: ShiftItem[])          => void;
  setLoading:          (v: boolean)                  => void;
  setError:            (msg: string | null)          => void;
  // Actualización parcial desde WebSocket
  updateItem:          (ingredientId: string, newRemaining: number) => void;
  clearShift:          ()                            => void;
}

function calcAlertCount(items: ShiftItem[]): number {
  return items.filter((i) => i.mini_status === 'CRITICO' || i.mini_status === 'AGOTADO').length;
}

function calcMiniStatus(remaining: number, withdrawn: number): MiniStatus {
  if (remaining <= 0)          return 'AGOTADO';
  if (withdrawn <= 0)          return 'OK';
  const pct = remaining / withdrawn;
  if (pct < 0.20)              return 'CRITICO';
  if (pct < 0.50)              return 'BAJO';
  return 'OK';
}

export const useShiftStore = create<ShiftState>()((set) => ({
  activeWithdrawal: null,
  items:            [],
  loading:          false,
  error:            null,
  alertCount:       0,

  setActiveWithdrawal: (activeWithdrawal) => set({ activeWithdrawal }),

  setItems: (items) => set({ items, loading: false, alertCount: calcAlertCount(items) }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  updateItem: (ingredientId, newRemaining) =>
    set((s) => {
      const items = s.items.map((i) => {
        if (i.ingredient_id !== ingredientId) return i;
        const consumed   = i.quantity_withdrawn - newRemaining;
        const miniStatus = calcMiniStatus(newRemaining, i.quantity_withdrawn);
        return { ...i, quantity_remaining: newRemaining, quantity_consumed: consumed, mini_status: miniStatus };
      });
      return { items, alertCount: calcAlertCount(items) };
    }),

  clearShift: () => set({ activeWithdrawal: null, items: [], alertCount: 0, error: null }),
}));