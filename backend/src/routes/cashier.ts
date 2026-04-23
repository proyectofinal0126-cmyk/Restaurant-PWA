// ============================================================
// backend/src/routes/cashier.ts  —  Fase 7
//
// Rutas del módulo Caja Con Mesero.
// Todas requieren autenticación con rol caja o admin.
//
// ⚠️ ORDEN CRÍTICO: rutas específicas ANTES que /:id
// ============================================================

import { Router } from 'express';
import {
  getWaitingBillTables,
  generateBill,
  payOrder,
  releaseTable,
} from '../controllers/cashierController';
import { authenticate } from '../middleware/auth';
import { requireRole }  from '../middleware/roleAuth';

const router = Router();

const isCaja = [authenticate, requireRole(['caja', 'admin'])];

// Mesas esperando cuenta
router.get('/tables/waiting-bill', ...isCaja, getWaitingBillTables);

// Liberar mesa (ruta específica antes que /:id)
router.patch('/tables/:id/release', ...isCaja, releaseTable);

// Generar cuenta detallada
router.post('/orders/:id/bill', ...isCaja, generateBill);

// Procesar pago
router.post('/orders/:id/pay', ...isCaja, payOrder);

export default router;