// ============================================================
// frontend/src/store/inventoryStore.ts  —  Fase 9
// ============================================================

import { create } from 'zustand';
import type {
  Ingredient, Supplier, InventoryMovement,
  ShiftWithdrawal, MovementFilter,
} from '../types/inventory';

interface InventoryState {
  // Ingredientes
  ingredients:    Ingredient[];
  ingLoading:     boolean;

  // Proveedores
  suppliers:      Supplier[];
  supLoading:     boolean;

  // Movimientos
  movements:      InventoryMovement[];
  movLoading:     boolean;
  movFilter:      MovementFilter;

  // Alertas de stock bajo
  lowStockItems:  Ingredient[];
  lowStockCount:  number;

  // Turno activo del cocinero
  activeWithdrawal: ShiftWithdrawal | null;
  wdLoading:        boolean;

  // Error global del módulo
  error: string | null;

  // ── Acciones ──────────────────────────────────────────────
  setIngredients:      (list: Ingredient[])             => void;
  setIngLoading:       (v: boolean)                     => void;
  updateIngredientInList: (i: Ingredient)               => void;
  removeIngredientFromList: (id: string)                => void;

  setSuppliers:        (list: Supplier[])               => void;
  setSupLoading:       (v: boolean)                     => void;
  updateSupplierInList:(s: Supplier)                    => void;

  setMovements:        (list: InventoryMovement[])      => void;
  setMovLoading:       (v: boolean)                     => void;
  setMovFilter:        (f: MovementFilter)              => void;

  setLowStock:         (list: Ingredient[])             => void;

  setActiveWithdrawal: (wd: ShiftWithdrawal | null)     => void;
  setWdLoading:        (v: boolean)                     => void;

  setError:            (msg: string | null)             => void;
}

export const useInventoryStore = create<InventoryState>()((set) => ({
  ingredients:      [],
  ingLoading:       false,
  suppliers:        [],
  supLoading:       false,
  movements:        [],
  movLoading:       false,
  movFilter:        {},
  lowStockItems:    [],
  lowStockCount:    0,
  activeWithdrawal: null,
  wdLoading:        false,
  error:            null,

  setIngredients:   (ingredients)  => set({ ingredients, ingLoading: false }),
  setIngLoading:    (v)            => set({ ingLoading: v }),
  updateIngredientInList: (ing)    =>
    set((s) => ({ ingredients: s.ingredients.map((i) => i.id === ing.id ? ing : i) })),
  removeIngredientFromList: (id)   =>
    set((s) => ({ ingredients: s.ingredients.filter((i) => i.id !== id) })),

  setSuppliers:     (suppliers)    => set({ suppliers, supLoading: false }),
  setSupLoading:    (v)            => set({ supLoading: v }),
  updateSupplierInList: (sup)      =>
    set((s) => ({ suppliers: s.suppliers.map((s2) => s2.id === sup.id ? sup : s2) })),

  setMovements:     (movements)    => set({ movements, movLoading: false }),
  setMovLoading:    (v)            => set({ movLoading: v }),
  setMovFilter:     (movFilter)    => set({ movFilter }),

  setLowStock:      (lowStockItems) =>
    set({ lowStockItems, lowStockCount: lowStockItems.length }),

  setActiveWithdrawal: (activeWithdrawal) => set({ activeWithdrawal, wdLoading: false }),
  setWdLoading:     (v)            => set({ wdLoading: v }),

  setError:         (error)        => set({ error }),
}));