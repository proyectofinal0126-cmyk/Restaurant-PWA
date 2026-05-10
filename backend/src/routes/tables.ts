// ============================================================
// backend/src/routes/tables.ts  —  Fase 6
//
// Sin cambios en las rutas — solo el controller fue actualizado.
// Se entrega completo para reemplazar el archivo anterior.
// ============================================================

import { Router } from 'express';
import {
  validateTable,
  getAllTables,
  updateTableStatus,
  createTable,
  updateTable,
  deleteTable,
} from '../controllers/tableController';
import { authenticate } from '../middleware/auth';
import { requireRole }  from '../middleware/roleAuth';

const router = Router();

// Validar mesa por número o QR — solo mesero/caja/admin
router.get(
  '/validate/:code',
  authenticate,
  requireRole(['mesero', 'caja', 'admin']),
  validateTable
);

// Mesas enriquecidas con datos de orden activa
router.get(
  '/',
  authenticate,
  requireRole(['mesero', 'caja', 'admin']),
  getAllTables
);

// Actualizar estado + broadcast WebSocket
router.patch(
  '/:id/status',
  authenticate,
  requireRole(['mesero', 'caja', 'admin']),
  updateTableStatus
);
router.post('/', authenticate, requireRole(['admin']), createTable);
router.put('/:id', authenticate, requireRole(['admin']), updateTable);
router.delete('/:id', authenticate, requireRole(['admin']), deleteTable);
export default router;