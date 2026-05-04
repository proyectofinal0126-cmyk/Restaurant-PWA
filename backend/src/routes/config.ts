// ============================================================
// backend/src/routes/config.ts
//
// Lee el modo de operación desde la variable de entorno
// OPERATION_MODE definida al momento del despliegue.
//
// .env del restaurante:
//   OPERATION_MODE=autoservicio   → solo kiosko QR
//   OPERATION_MODE=mesero         → solo servicio con mesero
//   OPERATION_MODE=ambos          → los dos modos (default)
//
// El restaurante NO puede cambiar esto desde la app.
// Solo el equipo técnico lo modifica al instalar el sistema.
// ============================================================

import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

const VALID_MODES = ['autoservicio', 'mesero', 'ambos'] as const;
type OperationMode = typeof VALID_MODES[number];

router.get('/', (_req: Request, res: Response) => {
  const raw  = (process.env.OPERATION_MODE ?? 'ambos').trim().toLowerCase();
  const operationMode: OperationMode = VALID_MODES.includes(raw as OperationMode)
    ? (raw as OperationMode)
    : 'ambos'; // fallback seguro si el valor en .env es inválido

  return res.json({ operationMode });
});

export default router;