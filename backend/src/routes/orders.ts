// ============================================================
// backend/src/routes/orders.ts  —  Fixes multi
//
// NUEVO: GET /api/orders/history  — historial del día (FIX 4)
// NUEVO: GET /api/orders/metrics  — timings operacionales (FIX 5)
// ============================================================

import { Router } from 'express';
import {
  createOrder,
  getOrderById,
  updateOrderStatus,
  getActiveOrders,
  getOrderHistory,
} from '../controllers/orderController';
import { closeOrder }  from '../controllers/cajaController';
import { getOrderMetrics } from '../controllers/metricsController';
import { authenticate }   from '../middleware/auth';
import { requireRole }    from '../middleware/roleAuth';

const router = Router();

// ── Rutas específicas (SIEMPRE antes que /:id) ───────────────

// Órdenes activas — caja, cocina, mesero, admin
router.get(
  '/active',
  authenticate,
  requireRole(['caja', 'cocina', 'mesero', 'admin']),
  getActiveOrders
);

// FIX 4: Historial del día — solo caja y admin
router.get(
  '/history',
  authenticate,
  requireRole(['caja', 'admin']),
  getOrderHistory
);

// FIX 5: Métricas operacionales — solo admin y caja
router.get(
  '/metrics',
  authenticate,
  requireRole(['caja', 'admin']),
  getOrderMetrics
);

// ── Ruta pública: crear orden ────────────────────────────────
router.post('/', createOrder);

// ── Rutas con parámetro /:id ─────────────────────────────────
router.get('/:id', getOrderById);

router.patch(
  '/:id/status',
  authenticate,
  requireRole(['caja', 'cocina', 'admin']),
  updateOrderStatus
);

router.post(
  '/:id/close',
  authenticate,
  requireRole(['caja', 'admin']),
  closeOrder
);

export default router;