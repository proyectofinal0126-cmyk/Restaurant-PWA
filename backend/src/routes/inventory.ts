// ============================================================
// backend/src/routes/inventory.ts  —  Fase 9
// ============================================================

import { Router } from 'express';
import {
  getIngredients, createIngredient, updateIngredient, deleteIngredient,
  registerEntry, registerAdjustment, getMovements, getLowStock,
  getSuppliers, createSupplier, updateSupplier,
  getRecipe, addRecipeIngredient, removeRecipeIngredient,
} from '../controllers/inventoryController';
import {
  createWithdrawal, getActiveWithdrawal, closeWithdrawal,
} from '../controllers/withdrawalController';
import { authenticate } from '../middleware/auth';
import { requireRole }  from '../middleware/roleAuth';

const router = Router();

const isAdmin  = [authenticate, requireRole(['admin'])];
const isBodega = [authenticate, requireRole(['admin', 'cocina'])];

// ── Ingredientes ─────────────────────────────────────────────
router.get('/ingredients',    ...isBodega, getIngredients);
router.post('/ingredients',   ...isAdmin,  createIngredient);
router.put('/ingredients/:id',...isAdmin,  updateIngredient);
router.delete('/ingredients/:id',...isAdmin, deleteIngredient);

// ── Entradas y ajustes ───────────────────────────────────────
router.post('/entries',      ...isAdmin, registerEntry);
router.post('/adjustments',  ...isAdmin, registerAdjustment);

// ── Movimientos e historial ──────────────────────────────────
router.get('/movements',  ...isBodega, getMovements);
router.get('/low-stock',  ...isBodega, getLowStock);

// ── Proveedores ──────────────────────────────────────────────
router.get('/suppliers',      ...isAdmin, getSuppliers);
router.post('/suppliers',     ...isAdmin, createSupplier);
router.put('/suppliers/:id',  ...isAdmin, updateSupplier);

// ── Recetas ──────────────────────────────────────────────────
router.get('/recipes/menu-item/:id',                         ...isAdmin, getRecipe);
router.post('/recipes/menu-item/:id',                        ...isAdmin, addRecipeIngredient);
router.delete('/recipes/menu-item/:id/ingredient/:iid',      ...isAdmin, removeRecipeIngredient);

// ── Retiros de turno (cocinero) ──────────────────────────────
router.post('/withdrawals',             ...isBodega, createWithdrawal);
router.get('/withdrawals/active',       ...isBodega, getActiveWithdrawal);
router.post('/withdrawals/:id/close',   ...isBodega, closeWithdrawal);

export default router;