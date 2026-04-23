// ============================================================
// frontend/src/store/cashierStore.ts  —  Fase 7
//
// Estado global del módulo Caja Con Mesero.
//
// PERSISTENCIA: sessionStorage (no localStorage).
// Se recupera si el usuario recarga por error durante un cobro,
// pero se limpia al cerrar el tab. Evita mostrar datos obsoletos
// de sesiones anteriores.
//
// SEPARACIÓN: totalmente independiente de cajaStore.ts (Fase 4,
// que es para Caja Autoservicio). Misma arquitectura, diferente dominio.
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  WaitingTable,
  BillDetail,
  PayOrderResponse,
  CashierPaymentMethod,
} from '../types/cashier';

interface CashierState {
  // ── Mesas esperando cuenta ──────────────────────────────
  waitingTables: WaitingTable[];
  loading:       boolean;
  error:         string | null;

  // ── Flujo de cobro activo ───────────────────────────────
  // Mesa seleccionada para cobrar
  selectedTable:    WaitingTable | null;
  // Cuenta detallada generada por el backend
  activeBill:       BillDetail | null;
  // Método de pago elegido
  paymentMethod:    CashierPaymentMethod;
  // Resultado del pago (para mostrar en TableRelease)
  paymentResult:    PayOrderResponse | null;
  // Flag de procesamiento (bloquea doble submit)
  isProcessing:     boolean;

  // ── Acciones ─────────────────────────────────────────────
  setWaitingTables:  (tables: WaitingTable[]) => void;
  removeWaitingTable:(tableId: string) => void;
  setLoading:        (v: boolean) => void;
  setError:          (msg: string | null) => void;

  selectTable:       (table: WaitingTable) => void;
  setActiveBill:     (bill: BillDetail)    => void;
  setPaymentMethod:  (m: CashierPaymentMethod) => void;
  setPaymentResult:  (r: PayOrderResponse) => void;
  setProcessing:     (v: boolean)          => void;

  // Limpia todo el flujo activo (tras liberar la mesa o cancelar)
  resetFlow:         () => void;
}

export const useCashierStore = create<CashierState>()(
  persist(
    (set) => ({
      waitingTables: [],
      loading:       false,
      error:         null,
      selectedTable: null,
      activeBill:    null,
      paymentMethod: 'efectivo',
      paymentResult: null,
      isProcessing:  false,

      setWaitingTables: (tables) =>
        set({ waitingTables: tables, loading: false, error: null }),

      removeWaitingTable: (tableId) =>
        set((s) => ({
          waitingTables: s.waitingTables.filter((t) => t.tableId !== tableId),
        })),

      setLoading:   (loading)  => set({ loading }),
      setError:     (error)    => set({ error, loading: false }),

      selectTable:  (table)    => set({ selectedTable: table, activeBill: null, paymentResult: null }),
      setActiveBill:(bill)     => set({ activeBill: bill }),
      setPaymentMethod: (m)   => set({ paymentMethod: m }),
      setPaymentResult: (r)   => set({ paymentResult: r }),
      setProcessing:(v)        => set({ isProcessing: v }),

      resetFlow: () =>
        set({
          selectedTable: null,
          activeBill:    null,
          paymentResult: null,
          paymentMethod: 'efectivo',
          isProcessing:  false,
          error:         null,
        }),
    }),
    {
      name:    'rpwa-cashier-session',
      // sessionStorage: se borra al cerrar el tab, no persiste entre sesiones
      storage: createJSONStorage(() => sessionStorage),
      // Solo persistir el flujo activo — las waiting tables siempre se recargan
      partialize: (s) => ({
        selectedTable: s.selectedTable,
        activeBill:    s.activeBill,
        paymentMethod: s.paymentMethod,
      }),
    }
  )
);