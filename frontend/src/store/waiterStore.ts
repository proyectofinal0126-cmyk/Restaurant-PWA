// ============================================================
// frontend/src/store/waiterStore.ts  —  Fase 6
//
// Estado global del módulo mesero. Maneja:
// 1. Lista de mesas con sus estados en tiempo real
// 2. Carrito activo por mesa (en memoria, no persiste)
// 3. Mesa seleccionada para tomar orden
//
// SIN persistencia — siempre fresco desde backend al cargar.
// El carrito se limpia al enviar la orden o cambiar de mesa.
//
// SEPARACIÓN TOTAL con autoservicio:
// Este store es completamente independiente de cartStore.ts
// ============================================================

import { create } from 'zustand';
import type { Table, TableStatus, WaiterCart, WaiterCartItem } from '../types/table';

interface WaiterState {
  // ── Mesas ───────────────────────────────────────────────
  tables:          Table[];
  loading:         boolean;
  error:           string | null;
  // Filtro de sección activo en el dashboard
  activeSection:   string | null;

  // ── Mesa seleccionada para tomar orden ──────────────────
  selectedTable:   Table | null;

  // ── Carrito activo (solo para la mesa seleccionada) ─────
  cart:            WaiterCart | null;

  // ── Acciones de mesas ───────────────────────────────────
  setTables:       (tables: Table[]) => void;
  updateTableStatus: (tableId: string, status: TableStatus, extra?: Partial<Table>) => void;
  setLoading:      (v: boolean) => void;
  setError:        (msg: string | null) => void;
  setActiveSection:(section: string | null) => void;

  // ── Acciones de mesa seleccionada ──────────────────────
  selectTable:     (table: Table) => void;
  clearSelectedTable: () => void;

  // ── Acciones del carrito ────────────────────────────────
  initCart:        (tableId: string, tableNumber: number) => void;
  addToCart:       (item: Omit<WaiterCartItem, 'quantity'> & { quantity?: number }) => void;
  removeFromCart:  (menuItemId: string) => void;
  updateCartQty:   (menuItemId: string, qty: number) => void;
  updateItemNotes: (menuItemId: string, notes: string) => void;
  setPaymentMethod:(method: WaiterCart['paymentMethod']) => void;
  setOrderNotes:   (notes: string) => void;
  clearCart:       () => void;

  // ── Getters computados ──────────────────────────────────
  getCartTotal:    () => number;
  getCartItemCount:() => number;
  getSections:     () => string[];
  getFilteredTables: () => Table[];
}

export const useWaiterStore = create<WaiterState>()((set, get) => ({
  tables:        [],
  loading:       false,
  error:         null,
  activeSection: null,
  selectedTable: null,
  cart:          null,

  // ── Mesas ────────────────────────────────────────────────
  setTables: (tables) =>
    set({ tables, loading: false, error: null }),

  updateTableStatus: (tableId, status, extra = {}) =>
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === tableId ? { ...t, status, ...extra } : t
      ),
      // Si la mesa seleccionada cambia, sincronizarla
      selectedTable:
        s.selectedTable?.id === tableId
          ? { ...s.selectedTable, status, ...extra }
          : s.selectedTable,
    })),

  setLoading:       (loading) => set({ loading }),
  setError:         (error)   => set({ error, loading: false }),
  setActiveSection: (section) => set({ activeSection: section }),

  // ── Mesa seleccionada ─────────────────────────────────────
  selectTable: (table) => set({ selectedTable: table }),
  clearSelectedTable: () => set({ selectedTable: null }),

  // ── Carrito ───────────────────────────────────────────────
  initCart: (tableId, tableNumber) =>
    set({
      cart: {
        tableId,
        tableNumber,
        items:         [],
        paymentMethod: 'efectivo',
        orderNotes:    '',
      },
    }),

  addToCart: (item) =>
    set((s) => {
      if (!s.cart) return {};
      const existing = s.cart.items.find((i) => i.menuItemId === item.menuItemId);
      if (existing) {
        return {
          cart: {
            ...s.cart,
            items: s.cart.items.map((i) =>
              i.menuItemId === item.menuItemId
                ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
                : i
            ),
          },
        };
      }
      return {
        cart: {
          ...s.cart,
          items: [
            ...s.cart.items,
            { ...item, quantity: item.quantity ?? 1, notes: item.notes ?? '' },
          ],
        },
      };
    }),

  removeFromCart: (menuItemId) =>
    set((s) => {
      if (!s.cart) return {};
      return {
        cart: {
          ...s.cart,
          items: s.cart.items.filter((i) => i.menuItemId !== menuItemId),
        },
      };
    }),

  updateCartQty: (menuItemId, qty) => {
    if (qty <= 0) {
      get().removeFromCart(menuItemId);
      return;
    }
    set((s) => {
      if (!s.cart) return {};
      return {
        cart: {
          ...s.cart,
          items: s.cart.items.map((i) =>
            i.menuItemId === menuItemId ? { ...i, quantity: qty } : i
          ),
        },
      };
    });
  },

  updateItemNotes: (menuItemId, notes) =>
    set((s) => {
      if (!s.cart) return {};
      return {
        cart: {
          ...s.cart,
          items: s.cart.items.map((i) =>
            i.menuItemId === menuItemId ? { ...i, notes } : i
          ),
        },
      };
    }),

  setPaymentMethod: (method) =>
    set((s) => ({
      cart: s.cart ? { ...s.cart, paymentMethod: method } : null,
    })),

  setOrderNotes: (notes) =>
    set((s) => ({
      cart: s.cart ? { ...s.cart, orderNotes: notes } : null,
    })),

  clearCart: () => set({ cart: null }),

  // ── Getters ───────────────────────────────────────────────
  getCartTotal: () => {
    const { cart } = get();
    if (!cart) return 0;
    return cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  },

  getCartItemCount: () => {
    const { cart } = get();
    if (!cart) return 0;
    return cart.items.reduce((sum, i) => sum + i.quantity, 0);
  },

  getSections: () => {
    const { tables } = get();
    const sections = tables
      .map((t) => t.section)
      .filter((s): s is string => s !== null && s !== '');
    return [...new Set(sections)].sort();
  },

  getFilteredTables: () => {
    const { tables, activeSection } = get();
    if (!activeSection) return tables;
    return tables.filter((t) => t.section === activeSection);
  },
}));