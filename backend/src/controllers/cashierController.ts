import { Request, Response } from 'express';
// backend/src/controllers/cashierController.ts  —  Fase 7
//
// Controladores del módulo Caja Con Mesero.
// Todas las operaciones usan transacciones DB para garantizar
// consistencia: pago + cierre de orden + liberación de mesa
// son atómicas — nunca quedan en estado intermedio.
// ============================================================

import pool            from '../utils/db';
import { broadcast }   from '../websocket/handlers';
import type { AuthRequest } from '../middleware/auth';

// ── GET /api/cashier/tables/waiting-bill ─────────────────────
// Lista mesas en waiting_bill con totales para el dashboard de caja.
export async function getWaitingBillTables(_req: AuthRequest, res: Response) {
  try {
    const result = await pool.query(`
      SELECT
        t.id            AS "tableId",
        t.number        AS "tableNumber",
        t.section,
        t.capacity,

        o.id            AS "orderId",
        o.order_number  AS "orderNumber",
        o.status        AS "orderStatus",
        o.subtotal,
        o.tax,
        o.total,
        o.payment_method AS "paymentMethod",
        o.created_at    AS "createdAt",
        o.delivered_at  AS "deliveredAt",

        CASE
          WHEN u.first_name IS NOT NULL
          THEN u.first_name || ' ' || u.last_name
          ELSE NULL
        END AS "waiterName"

      FROM tables t
      JOIN LATERAL (
        SELECT id, order_number, status, subtotal, tax, total,
               payment_method, created_at, delivered_at, waiter_id
        FROM orders
        WHERE table_id = t.id
          AND status NOT IN ('completed', 'cancelled')
        ORDER BY created_at DESC
        LIMIT 1
      ) o ON true
      LEFT JOIN users u ON o.waiter_id = u.id

      WHERE t.status = 'waiting_bill'
      ORDER BY o.created_at ASC
    `);

    return res.json(result.rows);
  } catch (err) {
    console.error('[cashier/waitingBill]', err);
    return res.status(500).json({ message: 'Error al obtener mesas en espera' });
  }
}

// ── POST /api/cashier/orders/:id/bill ────────────────────────
// Genera la cuenta detallada con cálculo de impuestos y propina.
export async function generateBill(req: AuthRequest, res: Response) {
  try {
    const { id: orderId } = req.params;

    // Orden con mesa y mesero
    const orderResult = await pool.query(
      `SELECT
         o.id, o.order_number, o.subtotal, o.tax, o.tip, o.total,
         o.payment_method, o.created_at, o.delivered_at,
         t.id        AS table_id,
         t.number    AS table_number,
         t.section,
         CASE WHEN u.first_name IS NOT NULL
              THEN u.first_name || ' ' || u.last_name
              ELSE NULL END AS waiter_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       LEFT JOIN users u  ON o.waiter_id = u.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (!orderResult.rows[0]) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    const order = orderResult.rows[0];

    // Items con instrucciones especiales
    const itemsResult = await pool.query(
      `SELECT mi.name, oi.quantity, oi.price AS unit_price,
              oi.special_instructions,
              oi.price * oi.quantity AS subtotal
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = $1
       ORDER BY mi.name`,
      [orderId]
    );

    const subtotal    = parseFloat(order.subtotal);
    const tax         = parseFloat(order.tax ?? '0');
    const tip         = parseFloat(order.tip ?? '0');
    const total       = parseFloat(order.total);
    const suggestedTip = parseFloat((subtotal * 0.10).toFixed(2));

    const bill = {
      orderId:      order.id,
      orderNumber:  order.order_number,
      tableId:      order.table_id,
      tableNumber:  order.table_number,
      section:      order.section,
      waiterName:   order.waiter_name,

      items: itemsResult.rows.map((row) => ({
        name:                row.name,
        quantity:            row.quantity,
        unitPrice:           parseFloat(row.unit_price),
        subtotal:            parseFloat(row.subtotal),
        specialInstructions: row.special_instructions,
      })),

      subtotal,
      tax,
      tip,
      suggestedTip,
      total,

      createdAt:   order.created_at,
      deliveredAt: order.delivered_at,
      generatedAt: new Date().toISOString(),
    };

    return res.json(bill);
  } catch (err) {
    console.error('[cashier/generateBill]', err);
    return res.status(500).json({ message: 'Error al generar la cuenta' });
  }
}

// ── POST /api/cashier/orders/:id/pay ─────────────────────────
// Procesa el pago de una orden.
// Validaciones: amountPaid >= total, protección contra doble cobro.
// Transacción atómica: actualiza orden + registra pago.
export async function payOrder(req: AuthRequest, res: Response) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id: orderId }   = req.params;
    const { method, amountPaid, tip = 0, reference } = req.body as {
      method:     string;
      amountPaid: number;
      tip?:       number;
      reference?: string;
    };
    const cashierId = req.user?.id ?? null;

    // 1. Obtener la orden y verificar que no está ya pagada
    const orderResult = await client.query(
      `SELECT id, order_number, status, payment_status, subtotal, tax, tip, total,
              table_id, waiter_id
       FROM orders WHERE id = $1`,
      [orderId]
    );

    if (!orderResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    const order = orderResult.rows[0];

    // Protección idempotente: si ya fue pagada, retornar 409
    if (order.payment_status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Esta orden ya fue pagada' });
    }

    // 2. Calcular total real con propina añadida
    const baseTotal     = parseFloat(order.total);
    const tipAmount     = parseFloat(String(tip)) || 0;
    const totalWithTip  = baseTotal + tipAmount;
    const paidAmount    = parseFloat(String(amountPaid));

    // 3. Validar monto — también se valida en frontend
    if (paidAmount < totalWithTip) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `El monto pagado ($${paidAmount.toFixed(2)}) es menor al total ($${totalWithTip.toFixed(2)})`,
      });
    }

    const change  = method === 'efectivo'
      ? parseFloat((paidAmount - totalWithTip).toFixed(2))
      : 0;
    const paidAt  = new Date().toISOString();

    // 4. Actualizar la orden
    await client.query(
      `UPDATE orders
       SET payment_status    = 'paid',
           payment_method    = $1,
           payment_reference = $2,
           cashier_id        = $3,
           tip               = tip + $4,
           total             = total + $4,
           updated_at        = NOW()
       WHERE id = $5`,
      [method, reference ?? null, cashierId, tipAmount, orderId]
    );

    // 5. Registrar en payments
    await client.query(
      `INSERT INTO payments (order_id, amount, method, status, reference, processed_at)
       VALUES ($1, $2, $3, 'paid', $4, NOW())`,
      [orderId, paidAmount, method, reference ?? null]
    );

    // 6. Audit log
    await client.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, user_id)
       VALUES ('order_paid', 'order', $1, $2)`,
      [orderId, cashierId]
    );

    await client.query('COMMIT');

    // 7. Obtener items para el comprobante
    const itemsResult = await pool.query(
      `SELECT mi.name, oi.quantity, oi.price AS unit_price,
              oi.special_instructions,
              oi.price * oi.quantity AS subtotal
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    // Mesa y mesero para el comprobante
    const metaResult = await pool.query(
      `SELECT t.number AS table_number, t.section,
              CASE WHEN u.first_name IS NOT NULL
                   THEN u.first_name || ' ' || u.last_name
                   ELSE NULL END AS waiter_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       LEFT JOIN users  u ON o.waiter_id = u.id
       WHERE o.id = $1`,
      [orderId]
    );
    const meta = metaResult.rows[0] ?? {};

    const receipt = {
      orderNumber:  order.order_number,
      tableNumber:  meta.table_number,
      section:      meta.section,
      waiterName:   meta.waiter_name,
      items: itemsResult.rows.map((row) => ({
        name:                row.name,
        quantity:            row.quantity,
        unitPrice:           parseFloat(row.unit_price),
        subtotal:            parseFloat(row.subtotal),
        specialInstructions: row.special_instructions,
      })),
      subtotal:   parseFloat(order.subtotal),
      tax:        parseFloat(order.tax ?? '0'),
      tip:        tipAmount,
      total:      totalWithTip,
      amountPaid: paidAmount,
      change,
      method,
      reference:  reference ?? null,
      createdAt:  order.created_at,
      paidAt,
    };

    // 8. Emitir WebSocket order:paid
    broadcast({
      type: 'order:paid',
      payload: {
        orderId,
        tableId:     order.table_id,
        tableNumber: meta.table_number,
        paidAt,
      },
    });

    return res.json({
      orderId,
      paidAt,
      amountPaid: paidAmount,
      change,
      tip:   tipAmount,
      total: totalWithTip,
      receipt,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[cashier/payOrder]', err);
    return res.status(500).json({ message: 'Error al procesar el pago' });
  } finally {
    client.release();
  }
}

// ── PATCH /api/cashier/tables/:id/release ────────────────────
// Libera la mesa (available) y cierra la orden (completed).
// Operación atómica: ambas actualizaciones en una sola transacción.
export async function releaseTable(req: AuthRequest, res: Response) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id: tableId } = req.params;
    const cashierId = req.user?.id ?? null;

    // 1. Verificar que la mesa existe y está en waiting_bill
    const tableResult = await client.query(
      `SELECT id, number, status FROM tables WHERE id = $1`,
      [tableId]
    );

    if (!tableResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Mesa no encontrada' });
    }

    const table = tableResult.rows[0];

    if (table.status !== 'waiting_bill') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `La mesa debe estar en 'waiting_bill'. Estado actual: ${table.status}`,
      });
    }

    // 2. Cerrar la orden activa en esta mesa (paid → completed)
    await client.query(
      `UPDATE orders
       SET status      = 'completed',
           cashier_id  = COALESCE(cashier_id, $1),
           completed_at = NOW(),
           updated_at   = NOW()
       WHERE table_id = $2
         AND status NOT IN ('completed', 'cancelled')`,
      [cashierId, tableId]
    );

    // 3. Liberar la mesa
    await client.query(
      `UPDATE tables SET status = 'available' WHERE id = $1`,
      [tableId]
    );

    // 4. Audit log
    await client.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, user_id)
       VALUES ('table_released', 'table', $1, $2)`,
      [tableId, cashierId]
    );

    await client.query('COMMIT');

    // 5. Emitir WebSocket table:released
    broadcast({
      type: 'table:released',
      payload: {
        tableId,
        tableNumber: table.number,
        status:      'available',
      },
    });

    // También emitir table:status para que el mesero actualice su dashboard
    broadcast({
      type: 'table:status',
      payload: {
        tableId,
        tableNumber: table.number,
        status:      'available',
      },
    });

    return res.json({ tableId, status: 'available' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[cashier/releaseTable]', err);
    return res.status(500).json({ message: 'Error al liberar la mesa' });
  } finally {
    client.release();
  }
}