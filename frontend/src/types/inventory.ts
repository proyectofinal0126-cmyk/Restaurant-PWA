// ============================================================
// frontend/src/types/inventory.ts  —  Fase 9
//
// Interfaces para el módulo de Inventario (Bodega).
// Todas las entidades reflejan exactamente las columnas de BD.
// ============================================================

// ── Estado de stock calculado ────────────────────────────────
export type StockStatus = 'OK' | 'BAJO' | 'CRITICO' | 'AGOTADO';

// ── Proveedor ────────────────────────────────────────────────
export interface Supplier {
  id:           string;
  name:         string;
  contact_name: string | null;
  phone:        string | null;
  email:        string | null;
  address:      string | null;
  is_active:    boolean;
  created_at:   string;
  updated_at:   string;
}

export interface SupplierForm {
  name:         string;
  contact_name: string;
  phone:        string;
  email:        string;
  address:      string;
  is_active:    boolean;
}

// ── Ingrediente ──────────────────────────────────────────────
export interface Ingredient {
  id:             string;
  name:           string;
  unit:           string;
  stock_quantity: number;
  min_stock:      number;
  cost_per_unit:  number;
  supplier_id:    string | null;
  supplier_name:  string | null;
  is_active:      boolean;
  status:         StockStatus;  // calculado en backend
  created_at:     string;
  updated_at:     string;
}

export interface IngredientForm {
  name:          string;
  unit:          string;
  stock_quantity: number;
  min_stock:     number;
  cost_per_unit: number;
  supplier_id:   string;
  is_active:     boolean;
}

// ── Movimientos de bodega ────────────────────────────────────
export type MovementType = 'entrada' | 'salida' | 'ajuste' | 'consumo_turno';

export interface InventoryMovement {
  id:                  string;
  ingredient_id:       string;
  ingredient_name:     string;
  unit:                string;
  type:                MovementType;
  quantity:            number;
  stock_after:         number | null;
  user_id:             string | null;
  user_name:           string | null;
  shift_withdrawal_id: string | null;
  notes:               string | null;
  created_at:          string;
}

export interface MovementFilter {
  ingredient_id?: string;
  type?:          MovementType | '';
  date_from?:     string;
  date_to?:       string;
  limit?:         number;
}

// ── Retiro de turno (cocinero) ───────────────────────────────
export interface ShiftWithdrawal {
  id:           string;
  cook_user_id: string;
  cook_name:    string;
  started_at:   string;
  closed_at:    string | null;
  status:       'abierto' | 'cerrado';
  notes:        string | null;
  items:        ShiftWithdrawalItem[];
}

export interface ShiftWithdrawalItem {
  id:                  string;
  shift_withdrawal_id: string;
  ingredient_id:       string;
  ingredient_name:     string;
  unit:                string;
  quantity_withdrawn:  number;
  quantity_remaining:  number | null;
  created_at:          string;
}

export interface WithdrawalItemInput {
  ingredient_id:      string;
  quantity_withdrawn: number;
}

// ── Recetas (menu_item_ingredients) ─────────────────────────
export interface RecipeIngredient {
  id:                string;
  menu_item_id:      string;
  menu_item_name:    string;
  ingredient_id:     string;
  ingredient_name:   string;
  unit:              string;
  quantity_required: number;
}

export interface RecipeIngredientForm {
  ingredient_id:     string;
  quantity_required: number;
}

// ── Entrada de mercancía ─────────────────────────────────────
export interface StockEntryForm {
  ingredient_id: string;
  quantity:      number;
  notes:         string;
}

// ── Ajuste manual ────────────────────────────────────────────
export interface StockAdjustmentForm {
  ingredient_id: string;
  quantity:      number;   // puede ser negativo (merma)
  notes:         string;   // OBLIGATORIO
}