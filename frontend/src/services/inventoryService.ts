// ============================================================
// frontend/src/services/inventoryService.ts  —  Fase 9
// ============================================================

import { apiFetch } from './api';
import type {
  Ingredient, IngredientForm,
  Supplier, SupplierForm,
  InventoryMovement, MovementFilter,
  ShiftWithdrawal, WithdrawalItemInput,
  RecipeIngredient, RecipeIngredientForm,
  StockEntryForm, StockAdjustmentForm,
} from '../types/inventory';

const BASE = '/inventory';

// ── Ingredientes ─────────────────────────────────────────────
export const getIngredients = (params?: {
  search?: string; status?: string; supplier_id?: string; active?: string;
}): Promise<Ingredient[]> => {
  const q = new URLSearchParams();
  if (params?.search)      q.set('search',      params.search);
  if (params?.status)      q.set('status',       params.status);
  if (params?.supplier_id) q.set('supplier_id',  params.supplier_id);
  if (params?.active)      q.set('active',        params.active);
  const qs = q.toString();
  return apiFetch<Ingredient[]>(`${BASE}/ingredients${qs ? `?${qs}` : ''}`);
};

export const createIngredient = (data: IngredientForm): Promise<Ingredient> =>
  apiFetch<Ingredient>(`${BASE}/ingredients`, { method: 'POST', body: JSON.stringify(data) });

export const updateIngredient = (id: string, data: Partial<IngredientForm>): Promise<Ingredient> =>
  apiFetch<Ingredient>(`${BASE}/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteIngredient = (id: string): Promise<void> =>
  apiFetch<void>(`${BASE}/ingredients/${id}`, { method: 'DELETE' });

// ── Entradas y ajustes ───────────────────────────────────────
export const registerEntry = (data: StockEntryForm): Promise<{ new_stock: number; status: string }> =>
  apiFetch(`${BASE}/entries`, { method: 'POST', body: JSON.stringify(data) });

export const registerAdjustment = (data: StockAdjustmentForm): Promise<{ new_stock: number; status: string }> =>
  apiFetch(`${BASE}/adjustments`, { method: 'POST', body: JSON.stringify(data) });

// ── Movimientos ──────────────────────────────────────────────
export const getMovements = (filter?: MovementFilter): Promise<InventoryMovement[]> => {
  const q = new URLSearchParams();
  if (filter?.ingredient_id) q.set('ingredient_id', filter.ingredient_id);
  if (filter?.type)          q.set('type',           filter.type);
  if (filter?.date_from)     q.set('date_from',       filter.date_from);
  if (filter?.date_to)       q.set('date_to',         filter.date_to);
  if (filter?.limit)         q.set('limit',            String(filter.limit));
  const qs = q.toString();
  return apiFetch<InventoryMovement[]>(`${BASE}/movements${qs ? `?${qs}` : ''}`);
};

export const getLowStock = (): Promise<Ingredient[]> =>
  apiFetch<Ingredient[]>(`${BASE}/low-stock`);

// ── Proveedores ──────────────────────────────────────────────
export const getSuppliers = (): Promise<Supplier[]> =>
  apiFetch<Supplier[]>(`${BASE}/suppliers`);

export const createSupplier = (data: SupplierForm): Promise<Supplier> =>
  apiFetch<Supplier>(`${BASE}/suppliers`, { method: 'POST', body: JSON.stringify(data) });

export const updateSupplier = (id: string, data: Partial<SupplierForm>): Promise<Supplier> =>
  apiFetch<Supplier>(`${BASE}/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ── Recetas ──────────────────────────────────────────────────
export const getRecipe = (menuItemId: string): Promise<RecipeIngredient[]> =>
  apiFetch<RecipeIngredient[]>(`${BASE}/recipes/menu-item/${menuItemId}`);

export const addRecipeIngredient = (menuItemId: string, data: RecipeIngredientForm): Promise<RecipeIngredient> =>
  apiFetch<RecipeIngredient>(`${BASE}/recipes/menu-item/${menuItemId}`, { method: 'POST', body: JSON.stringify(data) });

export const removeRecipeIngredient = (menuItemId: string, ingredientId: string): Promise<void> =>
  apiFetch<void>(`${BASE}/recipes/menu-item/${menuItemId}/ingredient/${ingredientId}`, { method: 'DELETE' });

// ── Retiros de turno ─────────────────────────────────────────
export const createWithdrawal = (items: WithdrawalItemInput[], notes?: string): Promise<ShiftWithdrawal> =>
  apiFetch<ShiftWithdrawal>(`${BASE}/withdrawals`, { method: 'POST', body: JSON.stringify({ items, notes }) });

export const getActiveWithdrawal = (): Promise<ShiftWithdrawal | null> =>
  apiFetch<ShiftWithdrawal | null>(`${BASE}/withdrawals/active`);

export const closeWithdrawal = (id: string): Promise<ShiftWithdrawal> =>
  apiFetch<ShiftWithdrawal>(`${BASE}/withdrawals/${id}/close`, { method: 'POST' });