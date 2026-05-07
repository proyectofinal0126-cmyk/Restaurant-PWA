// ============================================================
// backend/src/routes/orders.ts  —  Fase 10 (corregido)
//
// CAMBIO vs original:
//   + POST /items/:id/prepare  → prepareOrderItem (F10: descuenta
//     ingredientes del mini-inventario al marcar ítem como preparado)
//
// TODO lo demás se mantiene IGUAL al original del proyecto.
// ============================================================

import { Router } from 'express';
import {
  createOrder,
  getOrderById,
  updateOrderStatus,
  getActiveOrders,
  getOrderHistory,
  requestBill,
} from '../controllers/orderController';
import { closeOrder }        from '../controllers/cajaController';
import { getOrderMetrics }   from '../controllers/metricsController';
import { prepareOrderItem }  from '../controllers/shiftController';  // ← ÚNICO nuevo de F10
import { authenticate }      from '../middleware/auth';
import { requireRole }       from '../middleware/roleAuth';

const router = Router();

// ── Rutas específicas (SIEMPRE antes que /:id) ───────────────

// F10: preparar ítem y descontar mini-inventario (ANTES de /active para evitar conflicto)
router.post(
  '/items/:id/prepare',
  authenticate,
  requireRole(['cocina', 'admin']),
  prepareOrderItem
);

// Órdenes activas — caja, cocina, mesero, admin
router.get(
  '/active',
  authenticate,
  requireRole(['caja', 'cocina', 'mesero', 'admin']),
  getActiveOrders
);

// Historial del día — solo caja y admin
router.get(
  '/history',
  authenticate,
  requireRole(['caja', 'admin']),
  getOrderHistory
);

// Métricas operacionales — solo admin y caja
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
  requireRole(['caja', 'cocina', 'mesero', 'admin']),
  updateOrderStatus
);

// El mesero solicita la cuenta (cliente pidió pagar).
// Registra método de pago + propina → mesa pasa a waiting_bill → caja cobra.
router.patch(
  '/:id/request-bill',
  authenticate,
  requireRole(['mesero', 'admin']),
  requestBill
);

router.post(
  '/:id/close',
  authenticate,
  requireRole(['caja', 'admin']),
  closeOrder
);

export default router;