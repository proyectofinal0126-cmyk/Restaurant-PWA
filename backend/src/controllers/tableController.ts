// ============================================================
// backend/src/controllers/tableController.ts  —  Fase 6
//
// CAMBIOS vs versión anterior:
//
// 1. getAllTables(): query enriquecida con JOIN a orders + users.
//    Calcula current_order_id, current_order_number, waiter_name,
//    order_created_at SIN modificar el schema de tables.
//    (Decisión de diseño: opción B de la auditoría pre-Fase 6)
//
// 2. updateTableStatus(): agrega broadcast WebSocket table:status
//    para que el dashboard del mesero se actualice en tiempo real.
//    El broadcast va a roles ['mesero', 'caja', 'admin'].
// ============================================================

import { Request, Response } from 'express';
import pool                  from '../utils/db';
import { broadcast }         from '../websocket/handlers';

// ── GET /api/tables/validate/:code ───────────────────────────
// Valida una mesa por número o QR — solo flujo Con Mesero.
export async function validateTable(req: Request, res: Response) {
  try {
    const { code } = req.params;
    if (!code?.trim()) {
      return res.status(400).json({ message: 'Código de mesa requerido' });
    }

    const result = await pool.query(
      `SELECT id, number, capacity, section, status
       FROM tables
       WHERE number::text = $1 OR qr_code = $1`,
      [code.trim()]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: `Mesa "${code}" no encontrada` });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[tables/validate]', err);
    return res.status(500).json({ message: 'Error al validar la mesa' });
  }
}

// ── GET /api/tables ──────────────────────────────────────────
// Retorna todas las mesas enriquecidas con datos de la orden activa.
// JOIN con orders y users — SIN modificar el schema de tables.
//
// Campos calculados dinámicamente:
//   current_order_id     — UUID de la orden activa en esta mesa
//   current_order_number — Ej: 'ORD-0007'
//   current_order_status — Status legible
//   waiter_id            — UUID del mesero asignado
//   waiter_name          — Nombre completo del mesero
//   order_created_at     — Para calcular tiempo en mesa en el frontend
export async function getAllTables(_req: Request, res: Response) {
  try {
    const result = await pool.query(`
      SELECT
        t.id,
        t.number,
        t.capacity,
        t.section,
        t.status,
        t.qr_code,

        -- Orden activa (la más reciente no finalizada en esta mesa)
        o.id            AS current_order_id,
        o.order_number  AS current_order_number,
        o.status        AS current_order_status,
        o.created_at    AS order_created_at,

        -- Mesero asignado a la orden activa
        o.waiter_id,
        CASE
          WHEN u.first_name IS NOT NULL
          THEN u.first_name || ' ' || u.last_name
          ELSE NULL
        END             AS waiter_name

      FROM tables t

      -- LEFT JOIN para incluir mesas sin orden activa
      LEFT JOIN LATERAL (
        SELECT id, order_number, status, created_at, waiter_id
        FROM orders
        WHERE table_id = t.id
          AND status NOT IN ('completed', 'cancelled')
        ORDER BY created_at DESC
        LIMIT 1
      ) o ON true

      LEFT JOIN users u ON o.waiter_id = u.id

      ORDER BY t.number ASC
    `);

    return res.json(result.rows);
  } catch (err) {
    console.error('[tables/all]', err);
    return res.status(500).json({ message: 'Error al obtener mesas' });
  }
}

// ── PATCH /api/tables/:id/status ─────────────────────────────
// Actualiza el estado de una mesa y emite WebSocket a meseros.
export async function updateTableStatus(req: Request, res: Response) {
  try {
    const { id }     = req.params;
    const { status } = req.body as { status: string };

    const allowed = ['available', 'occupied', 'reserved', 'waiting_bill'];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `Estado inválido. Permitidos: ${allowed.join(', ')}`,
      });
    }

    const result = await pool.query(
      `UPDATE tables
       SET status = $1
       WHERE id = $2
       RETURNING id, number, status, section`,
      [status, id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Mesa no encontrada' });
    }

    const updated = result.rows[0];

    // FIX FASE 6: Emitir WebSocket a roles mesero/caja/admin
    // El frontend del mesero escucha 'table:status' para
    // actualizar el dashboard sin recargar.
    broadcast({
      type:    'table:status',
      payload: {
        tableId:     updated.id,
        tableNumber: updated.number,
        status:      updated.status,
        section:     updated.section,
      },
      // Sin targetOrderId → llega a todos los clientes con rol global
    });

    return res.json(updated);
  } catch (err) {
    console.error('[tables/status]', err);
    return res.status(500).json({ message: 'Error al actualizar estado de mesa' });
  }
}