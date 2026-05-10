// ============================================================
// backend/src/controllers/orderController.ts
//
// CAMBIOS DE FLUJO (Solicitud de cuenta separada):
//
//  createOrder:
//    - payment_method OPCIONAL para source='waiter' (se define cuando
//      el cliente pide la cuenta, no al tomar el pedido).
//
//  updateOrderStatus:
//    - Al marcar 'delivered', la mesa queda en 'occupied', NO en
//      'waiting_bill'. El cliente puede seguir en la mesa; la cuenta
//      se solicita explícitamente con el nuevo endpoint.
//
//  requestBill (NUEVO):
//    - PATCH /api/orders/:id/request-bill
//    - El mesero la llama cuando el cliente pide la cuenta.
//    - Recibe payment_method, tip, notas. Actualiza la orden y cambia
//      la mesa a 'waiting_bill'. Caja interviene a partir de aquí.
//
// ============================================================

import { Request, Response } from 'express';
import pool from '../utils/db';
import { broadcast } from '../websocket/handlers';

type OrderSource = 'autoservicio' | 'waiter' | 'kiosk';

interface OrderItemInput {
  menu_item_id: string;
  quantity: number;
  special_instructions?: string;
}

const VALID_SOURCES: OrderSource[] = ['autoservicio', 'waiter', 'kiosk'];

// ── POST /api/orders ─────────────────────────────────────────
export async function createOrder(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { table_id, items, payment_method, notes, source = 'autoservicio', waiter_id } = req.body as {
      table_id:  string | null;
      items:     OrderItemInput[];
      payment_method?: string | null;   // Opcional para source='waiter': se define al solicitar cuenta
      notes?:    string;
      source?:   string;
      waiter_id?: string;
    };

    if (!VALID_SOURCES.includes(source as OrderSource)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `source inválido. Permitidos: ${VALID_SOURCES.join(', ')}` });
    }

    if (!items || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'La orden debe tener al menos un item' });
    }

    if (source === 'waiter' && !table_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'table_id es requerido para source=waiter' });
    }

    if (table_id) {
      const tableCheck = await client.query(
        'SELECT id, status FROM tables WHERE id = $1',
        [table_id]
      );
      if (!tableCheck.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Mesa no encontrada' });
      }
    }

    // Verificar items y obtener precios reales
    const itemIds    = items.map((i) => i.menu_item_id);
    const menuResult = await client.query(
      `SELECT id, name, price, is_available, is_out_of_stock
       FROM menu_items WHERE id = ANY($1::uuid[])`,
      [itemIds]
    );
    const menuMap = new Map(menuResult.rows.map((r) => [r.id, r]));

    for (const item of items) {
      const mi = menuMap.get(item.menu_item_id);
      if (!mi) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Item "${item.menu_item_id}" no existe` });
      }
      if (!mi.is_available || mi.is_out_of_stock) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `"${mi.name}" no está disponible` });
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Cantidad inválida para "${mi.name}"` });
      }
    }

    // Calcular totales en backend
    let subtotal = 0;
    for (const item of items) {
      subtotal += parseFloat(menuMap.get(item.menu_item_id)!.price) * item.quantity;
    }
    const tax   = parseFloat((subtotal * 0.08).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    // Generar order_number atómico
    const seqResult   = await client.query(`SELECT nextval('order_number_seq') AS seq`);
    const orderNumber = `ORD-${String(seqResult.rows[0].seq).padStart(4, '0')}`;

    // Insertar la orden con waiter_id si viene del mesero
    // FLUJO MESERO: la orden va directo a cocina (sent_to_kitchen).
    // FLUJO AUTOSERVICIO: primero pasa por caja (pending_payment).
    const initialStatus = source === 'waiter' ? 'sent_to_kitchen' : 'pending_payment';
    const sentToKitchenAt = source === 'waiter' ? 'NOW()' : 'NULL';

    const orderResult = await client.query(
      `INSERT INTO orders
         (order_number, table_id, waiter_id, subtotal, tax, total, status,
          payment_method, payment_status, source, notes, sent_to_kitchen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10,${sentToKitchenAt})
       RETURNING *`,
      [
        orderNumber,
        table_id ?? null,
        waiter_id ?? null,
        subtotal.toFixed(2),
        tax.toFixed(2),
        total.toFixed(2),
        initialStatus,
        source === 'waiter' ? null : (payment_method ?? null),   // waiter: sin método todavía
        source,
        notes ?? null,
      ]
    );
    const order = orderResult.rows[0];

    // Insertar items
    for (const item of items) {
      const mi = menuMap.get(item.menu_item_id)!;
      await client.query(
        `INSERT INTO order_items
           (order_id, menu_item_id, quantity, price, special_instructions, status)
         VALUES ($1,$2,$3,$4,$5,'pending')`,
        [order.id, item.menu_item_id, item.quantity, mi.price, item.special_instructions ?? null]
      );
    }

    // FIX 1: Si la orden es del mesero, marcar la mesa como 'occupied'
    // En autoservicio no hay mesa, por eso solo aplica con table_id.
    if (table_id && source === 'waiter') {
      await client.query(
        `UPDATE tables SET status = 'occupied' WHERE id = $1`,
        [table_id]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id)
       VALUES ('order_created','order',$1)`,
      [order.id]
    );

    await client.query('COMMIT');

    // Obtener items CON nombres ANTES del broadcast para incluirlos en el payload.
    // Antes este query estaba después del broadcast, por lo que order:new llegaba
    // al panel monitor de caja sin items y los cards aparecían vacíos.
    const itemsResult = await pool.query(
      `SELECT oi.id, oi.menu_item_id, oi.quantity, oi.price,
              oi.special_instructions, oi.status, mi.name
       FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    // Broadcast order:new con items incluidos para que el monitor de caja
    // y la cocina tengan la información de platos desde el primer momento.
    broadcast({
      type: 'order:new',
      payload: {
        orderId:     order.id,
        orderNumber: order.order_number,
        tableId:     order.table_id,
        tableNumber: (order as { table_number?: number }).table_number ?? null,
        waiterName:  (order as { waiter_name?: string }).waiter_name ?? null,
        subtotal:    parseFloat(order.subtotal),
        tax:         parseFloat(order.tax),
        total:       parseFloat(order.total),
        status:      order.status,
        source:      order.source,
        items: itemsResult.rows.map((i: { name: string; quantity: number; special_instructions: string | null }) => ({
          name:     i.name,
          quantity: i.quantity,
          special_instructions: i.special_instructions,
        })),
      },
    });

    // Si hay mesa, también emitir table:status para que el dashboard
    // del mesero actualice la tarjeta en tiempo real
    if (table_id && source === 'waiter') {
      broadcast({
        type: 'table:status',
        payload: {
          tableId:     table_id,
          status:      'occupied',
          orderStatus: order.status,
          orderId:     order.id,
          orderNumber: order.order_number,
        },
      });
    }

    return res.status(201).json({ ...order, items: itemsResult.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[orders/create]', err);
    return res.status(500).json({ message: 'Error al crear la orden' });
  } finally {
    client.release();
  }
}

// ── GET /api/orders/:id ──────────────────────────────────────
export async function getOrderById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const orderResult = await pool.query(
      `SELECT id, order_number, table_id, subtotal, tax, discount, tip,
              total, status, payment_method, payment_status, source, notes,
              created_at, validated_at, sent_to_kitchen_at, ready_at,
              delivered_at, completed_at
       FROM orders WHERE id = $1`,
      [id]
    );
    if (!orderResult.rows[0]) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    const itemsResult = await pool.query(
      `SELECT oi.id, oi.menu_item_id, oi.quantity, oi.price,
              oi.special_instructions, oi.status, mi.name
       FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = $1`,
      [id]
    );
    return res.json({ ...orderResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    console.error('[orders/getById]', err);
    return res.status(500).json({ message: 'Error al obtener la orden' });
  }
}

// ── PATCH /api/orders/:id/status ─────────────────────────────
export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    const allowed = [
      'pending_payment','payment_confirmed','pending_validation',
      'sent_to_kitchen','in_preparation','ready_for_pickup',
      'delivered','completed','cancelled',
    ];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Estado inválido: ${status}` });
    }

    // El mesero solo puede marcar como 'delivered' — nada más
    const userRole = (req as import('express').Request & { user?: { role: string } }).user?.role;
    if (userRole === 'mesero' && status !== 'delivered') {
      return res.status(403).json({ message: 'El mesero solo puede marcar órdenes como entregadas' });
    }

    const timestamps: Record<string, string> = {
      payment_confirmed:  'validated_at = NOW(),',
      pending_validation: 'validated_at = NOW(),',
      sent_to_kitchen:    'sent_to_kitchen_at = NOW(),',
      ready_for_pickup:   'ready_at = NOW(),',
      delivered:          'delivered_at = NOW(),',
      completed:          'completed_at = NOW(),',
    };
    const extraTs = timestamps[status] ?? '';

    const result = await pool.query(
      `UPDATE orders
       SET status = $1, ${extraTs} updated_at = NOW()
       WHERE id = $2
       RETURNING id, order_number, status, table_id`,
      [status, id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    const updated = result.rows[0];

    // Cuando el mesero entrega el pedido → la mesa queda en 'occupied'.
    // El cliente sigue en la mesa; puede pedir más cosas o pedir la cuenta.
    // La mesa pasa a 'waiting_bill' SOLO cuando el mesero llama a
    // PATCH /api/orders/:id/request-bill (cliente pidió la cuenta).
    if (status === 'delivered' && updated.table_id) {
      await pool.query(
        `UPDATE tables SET status = 'occupied' WHERE id = $1`,
        [updated.table_id]
      );
      broadcast({
        type: 'table:status',
        payload: {
          tableId:     updated.table_id,
          status:      'occupied',
          orderStatus: 'delivered',
          orderId:     updated.id,
          orderNumber: updated.order_number,
        },
      });
    }

    // FIX 3: broadcast order:status incluye tableId para que el mesero
    // pueda actualizar el badge de estado en la tarjeta de la mesa
    broadcast({
      type: 'order:status',
      payload: {
        orderId:  updated.id,
        status:   updated.status,
        tableId:  updated.table_id,
      },
      // Sin targetOrderId → llega a todos los roles globales (cocina/caja/mesero/admin)
    });

    if (status === 'ready_for_pickup') {
      broadcast({
        type: 'order:ready',
        payload: { orderId: updated.id, orderNumber: updated.order_number, tableId: updated.table_id },
        targetOrderId: updated.id,
      });
    }

    return res.json(updated);
  } catch (err) {
    console.error('[orders/updateStatus]', err);
    return res.status(500).json({ message: 'Error al actualizar estado' });
  }
}

// ── GET /api/orders/active ───────────────────────────────────
export async function getActiveOrders(_req: Request, res: Response) {
  try {
    const result = await pool.query(`
      SELECT
        o.id, o.order_number, o.status, o.payment_method,
        o.subtotal, o.tax, o.total, o.notes, o.source,
        o.created_at, o.updated_at,
        t.number AS table_number,
        COALESCE(
          json_agg(
            json_build_object(
              'id',         oi.id,
              'name',       mi.name,
              'quantity',   oi.quantity,
              'price', oi.price,
              'special_instructions', oi.special_instructions
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM orders o
      LEFT JOIN tables t       ON o.table_id = t.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi  ON oi.menu_item_id = mi.id
      WHERE o.status NOT IN ('completed', 'cancelled')
      GROUP BY o.id, t.number
      ORDER BY o.created_at ASC
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('[orders/active]', err);
    return res.status(500).json({ message: 'Error al obtener órdenes activas' });
  }
}

// ── GET /api/orders/history ──────────────────────────────────
// FIX 4: Historial de pedidos del día para caja
export async function getOrderHistory(req: Request, res: Response) {
  try {
    const { date } = req.query; // opcional: YYYY-MM-DD, default hoy
    const targetDate = date ? String(date) : new Date().toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT
        o.id, o.order_number, o.status, o.payment_method, o.payment_status,
        o.subtotal, o.tax, o.tip, o.total, o.source, o.notes,
        o.created_at, o.completed_at, o.delivered_at,
        o.validated_at, o.sent_to_kitchen_at, o.ready_at,
        t.number AS table_number,
        CASE WHEN uw.first_name IS NOT NULL
             THEN uw.first_name || ' ' || uw.last_name
             ELSE NULL END AS waiter_name,
        CASE WHEN uc.first_name IS NOT NULL
             THEN uc.first_name || ' ' || uc.last_name
             ELSE NULL END AS cashier_name,
        COALESCE(
          json_agg(
            json_build_object(
              'name',     mi.name,
              'quantity', oi.quantity,
              'price',    oi.price,
              'subtotal', oi.price * oi.quantity
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM orders o
      LEFT JOIN tables t   ON o.table_id  = t.id
      LEFT JOIN users uw   ON o.waiter_id = uw.id
      LEFT JOIN users uc   ON o.cashier_id = uc.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi  ON oi.menu_item_id = mi.id
      WHERE o.status IN ('completed', 'cancelled')
        AND DATE(o.created_at AT TIME ZONE 'America/Bogota') = $1
      GROUP BY o.id, t.number, uw.first_name, uw.last_name, uc.first_name, uc.last_name
      ORDER BY o.created_at DESC
    `, [targetDate]);

    // Calcular métricas del día para cerrar caja
    const totals = result.rows.reduce(
      (acc, o) => {
        if (o.status === 'completed') {
          acc.totalRevenue   += parseFloat(o.total ?? '0');
          acc.totalOrders    += 1;
          acc.totalTips      += parseFloat(o.tip ?? '0');
        }
        return acc;
      },
      { totalRevenue: 0, totalOrders: 0, totalTips: 0 }
    );

    return res.json({
      date:   targetDate,
      orders: result.rows,
      summary: {
        totalOrders:   totals.totalOrders,
        totalRevenue:  parseFloat(totals.totalRevenue.toFixed(2)),
        totalTips:     parseFloat(totals.totalTips.toFixed(2)),
        avgOrderValue: totals.totalOrders > 0
          ? parseFloat((totals.totalRevenue / totals.totalOrders).toFixed(2))
          : 0,
      },
    });
  } catch (err) {
    console.error('[orders/history]', err);
    return res.status(500).json({ message: 'Error al obtener historial' });
  }
}
// ── PATCH /api/orders/:id/request-bill ───────────────────────
// El mesero llama a este endpoint cuando el cliente pide la cuenta.
// Recibe: payment_method, tip (propina), notas opcionales.
// Actualiza la orden con esos datos y cambia la mesa a waiting_bill.
// A partir de aquí, caja puede ver la mesa y cobrarla.
// SOLO el mesero (o admin) puede llamar este endpoint.
export async function requestBill(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { payment_method, tip = 0, notes } = req.body as {
      payment_method: string;
      tip?:           number;
      notes?:         string;
    };

    const validMethods = ['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'tarjeta'];
    if (!validMethods.includes(payment_method)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Método de pago inválido' });
    }

    // Verificar que la orden existe y está en estado delivered (o delivered/occupied)
    const orderResult = await client.query(
      `SELECT id, order_number, status, table_id, total, subtotal, tax
       FROM orders WHERE id = $1`,
      [id]
    );

    if (!orderResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    const order = orderResult.rows[0];

    // Solo se puede solicitar cuenta si la orden fue entregada
    if (!['delivered', 'sent_to_kitchen', 'in_preparation', 'ready_for_pickup'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `No se puede solicitar cuenta en estado: ${order.status}`,
      });
    }

    const tipAmount    = parseFloat(String(tip)) || 0;
    const totalWithTip = parseFloat(order.total) + tipAmount;

    // Actualizar la orden: guardar método de pago, propina, nuevo total, status
    const updated = await client.query(
      `UPDATE orders
       SET payment_method = $1,
           tip            = $2,
           total          = $3,
           status         = 'waiting_bill',
           notes          = COALESCE($4, notes),
           updated_at     = NOW()
       WHERE id = $5
       RETURNING id, order_number, status, table_id, payment_method, tip, total, subtotal, tax`,
      [payment_method, tipAmount.toFixed(2), totalWithTip.toFixed(2), notes ?? null, id]
    );

    const updatedOrder = updated.rows[0];

    // Cambiar mesa a waiting_bill — ahora sí interviene caja
    if (updatedOrder.table_id) {
      await client.query(
        `UPDATE tables SET status = 'waiting_bill' WHERE id = $1`,
        [updatedOrder.table_id]
      );
    }

    await client.query('COMMIT');

    // Broadcast: la orden ahora está en waiting_bill con datos de pago
    broadcast({
      type:    'order:bill_requested',
      payload: {
        orderId:       updatedOrder.id,
        orderNumber:   updatedOrder.order_number,
        tableId:       updatedOrder.table_id,
        paymentMethod: updatedOrder.payment_method,
        tip:           parseFloat(updatedOrder.tip   ?? '0'),
        subtotal:      parseFloat(updatedOrder.subtotal),
        tax:           parseFloat(updatedOrder.tax),
        total:         parseFloat(updatedOrder.total),
        status:        'waiting_bill',
      },
    });

    // También broadcast table:status para que el dashboard del mesero
    // y el panel de caja actualicen la mesa en tiempo real
    if (updatedOrder.table_id) {
      broadcast({
        type: 'table:status',
        payload: {
          tableId:     updatedOrder.table_id,
          status:      'waiting_bill',
          orderStatus: 'waiting_bill',
          orderId:     updatedOrder.id,
          orderNumber: updatedOrder.order_number,
        },
      });
    }

    // Broadcast order:status genérico para el panel monitor de caja
    broadcast({
      type: 'order:status',
      payload: {
        orderId:  updatedOrder.id,
        status:   'waiting_bill',
        tableId:  updatedOrder.table_id,
      },
    });

    return res.json({
      message:       'Cuenta solicitada correctamente',
      orderId:       updatedOrder.id,
      orderNumber:   updatedOrder.order_number,
      paymentMethod: updatedOrder.payment_method,
      tip:           parseFloat(updatedOrder.tip   ?? '0'),
      subtotal:      parseFloat(updatedOrder.subtotal),
      tax:           parseFloat(updatedOrder.tax),
      total:         parseFloat(updatedOrder.total),
      status:        'waiting_bill',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[orders/requestBill]', err);
    return res.status(500).json({ message: 'Error al solicitar la cuenta' });
  } finally {
    client.release();
  }
}