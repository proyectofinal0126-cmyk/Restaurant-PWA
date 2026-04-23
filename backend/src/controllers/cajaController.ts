// ============================================================
// backend/src/controllers/cajaController.ts  —  Fase 4
//
// POST /api/orders/:id/close
//   Cierra la orden, registra al cajero, genera recibo digital
//   y notifica por WebSocket al cliente que rastreaba su pedido.
//
// GET /api/orders/active
//   Retorna todas las órdenes no finalizadas para el dashboard.
//   (Movido aquí para separar responsabilidades del orderController)
// ============================================================

import { Request, Response } from 'express';
import pool                  from '../utils/db';
import { broadcast }         from '../websocket/handlers';
import type { AuthRequest }  from '../middleware/auth';

// ── POST /api/orders/:id/close ───────────────────────────────
export async function closeOrder(req: AuthRequest, res: Response) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id }            = req.params;
    const { cashier_notes } = req.body as { cashier_notes?: string };
    const cashierId         = req.user?.id ?? null;

    // 1. Verificar que la orden existe y está en ready_for_pickup
    const orderResult = await client.query(
      `SELECT o.id, o.order_number, o.status, o.subtotal, o.tax, o.total,
              o.payment_method, o.created_at, o.source
       FROM orders o
       WHERE o.id = $1`,
      [id]
    );

    if (!orderResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    const order = orderResult.rows[0];

    if (order.status !== 'ready_for_pickup') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `La orden debe estar en estado 'ready_for_pickup'. Estado actual: ${order.status}`,
      });
    }

    // 2. Actualizar a completed y registrar cajero + timestamps
    const now = new Date().toISOString();
    await client.query(
      `UPDATE orders
       SET status        = 'completed',
           cashier_id    = $1,
           delivered_at  = NOW(),
           completed_at  = NOW(),
           updated_at    = NOW(),
           notes         = COALESCE(notes, '') || COALESCE($2, '')
       WHERE id = $3`,
      [cashierId, cashier_notes ? `\nCajero: ${cashier_notes}` : null, id]
    );

    // 3. Obtener items para el recibo
    const itemsResult = await client.query(
      `SELECT oi.quantity, oi.price, mi.name
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = $1`,
      [id]
    );

    await client.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, user_id)
       VALUES ('order_closed', 'order', $1, $2)`,
      [id, cashierId]
    );

    await client.query('COMMIT');

    // 4. Construir recibo digital
    const receiptItems = itemsResult.rows.map((row) => ({
      name:     row.name,
      quantity: row.quantity,
      price:    parseFloat(row.price),
      subtotal: parseFloat(row.price) * row.quantity,
    }));

    const receipt = {
      order_number:   order.order_number,
      items:          receiptItems,
      subtotal:       parseFloat(order.subtotal),
      tax:            parseFloat(order.tax ?? '0'),
      total:          parseFloat(order.total),
      payment_method: order.payment_method ?? '',
      created_at:     order.created_at,
      completed_at:   now,
    };

    // 5. Notificar al cliente vía WebSocket
    broadcast({
      type:          'order:status',
      payload:       { orderId: id, status: 'completed' },
      targetOrderId: id,
    });

    return res.json({
      order:   { ...order, status: 'completed', completed_at: now },
      receipt,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[caja/closeOrder]', err);
    return res.status(500).json({ message: 'Error al cerrar la orden' });
  } finally {
    client.release();
  }
}