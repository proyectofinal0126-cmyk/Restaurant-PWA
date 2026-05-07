// ============================================================
// backend/src/routes/inventory.ts  —  Fase 9 + 10
//
// NUEVO en F10:
//   GET  /withdrawals/:id/items          → mini-inventario del turno
//   POST /withdrawals/:id/restock        → reabastecimiento parcial
//   GET  /withdrawals/:id/consumption    → resumen consumo
//   POST /withdrawals/:id/close-liquidation → cierre con mermas/devoluciones
//   GET  /withdrawals/history            → historial de turnos
//   GET  /shifts/report                  → reporte admin
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
import {
  getWithdrawalItems, restockWithdrawal, getConsumption,
  closeTurnWithLiquidation, getWithdrawalHistory, getShiftsReport,
} from '../controllers/shiftController';
import { authenticate } from '../middleware/auth';
import { requireRole }  from '../middleware/roleAuth';

const router = Router();

const isAdmin  = [authenticate, requireRole(['admin'])];
const isBodega = [authenticate, requireRole(['admin', 'cocina'])];

// ── Ingredientes ─────────────────────────────────────────────
router.get('/ingredients',        ...isBodega, getIngredients);
router.post('/ingredients',       ...isAdmin,  createIngredient);
router.put('/ingredients/:id',    ...isAdmin,  updateIngredient);
router.delete('/ingredients/:id', ...isAdmin,  deleteIngredient);

// ── Entradas y ajustes ───────────────────────────────────────
router.post('/entries',      ...isAdmin, registerEntry);
router.post('/adjustments',  ...isAdmin, registerAdjustment);

// ── Movimientos e historial ──────────────────────────────────
router.get('/movements',  ...isBodega, getMovements);
router.get('/low-stock',  ...isBodega, getLowStock);

// ── Proveedores ──────────────────────────────────────────────
router.get('/suppliers',       ...isAdmin, getSuppliers);
router.post('/suppliers',      ...isAdmin, createSupplier);
router.put('/suppliers/:id',   ...isAdmin, updateSupplier);

// ── Recetas ──────────────────────────────────────────────────
router.get('/recipes/menu-item/:id',                    ...isAdmin, getRecipe);
router.post('/recipes/menu-item/:id',                   ...isAdmin, addRecipeIngredient);
router.delete('/recipes/menu-item/:id/ingredient/:iid', ...isAdmin, removeRecipeIngredient);

// ── Retiros de turno ─────────────────────────────────────────
// IMPORTANTE: rutas específicas ANTES de las parametrizadas (:id)
router.get('/withdrawals/active',    ...isBodega, getActiveWithdrawal);
router.get('/withdrawals/history',   ...isBodega, getWithdrawalHistory);   // ← F10
router.post('/withdrawals',          ...isBodega, createWithdrawal);
router.get('/withdrawals/:id/items', ...isBodega, getWithdrawalItems);     // ← F10
router.get('/withdrawals/:id/consumption', ...isBodega, getConsumption);   // ← F10
router.post('/withdrawals/:id/restock',    ...isBodega, restockWithdrawal);// ← F10
router.post('/withdrawals/:id/close',      ...isBodega, closeWithdrawal);  // F9 básico
router.post('/withdrawals/:id/close-liquidation', ...isBodega, closeTurnWithLiquidation); // ← F10

// ── Reportes de turnos (admin) ───────────────────────────────
router.get('/shifts/report', ...isAdmin, getShiftsReport);  // ← F10

export default router;