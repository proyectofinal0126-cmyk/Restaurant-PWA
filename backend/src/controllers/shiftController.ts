// ============================================================
// backend/src/controllers/shiftController.ts  —  Fase 10
//
// Mini-inventario del turno activo del cocinero.
//
// Endpoints:
//   GET  /api/inventory/withdrawals/:id/items        → stock actual del turno
//   POST /api/inventory/withdrawals/:id/restock      → reabastecimiento parcial
//   POST /api/orders/items/:id/prepare               → descuento al preparar ítem
//   GET  /api/inventory/withdrawals/:id/consumption  → resumen de consumo
//   GET  /api/inventory/withdrawals/history          → historial de turnos del cocinero
//   GET  /api/inventory/shifts/report                → reporte admin
// ============================================================

import { Response }         from 'express';
import pool                 from '../utils/db';
import { broadcast }        from '../websocket/handlers';
import type { AuthRequest } from '../middleware/auth';

// ── Calcular estado del mini-inventario por ingrediente ──────
function calcMiniStatus(remaining: number, withdrawn: number): string {
  if (remaining <= 0)                          return 'AGOTADO';
  if (withdrawn <= 0)                          return 'OK';
  const pct = remaining / withdrawn;
  if (pct < 0.20)                              return 'CRITICO';
  if (pct < 0.50)                              return 'BAJO';
  return 'OK';
}

// ── GET /api/inventory/withdrawals/:id/items ─────────────────
// Devuelve el stock actual de cada ingrediente en el mini-inventario
export async function getWithdrawalItems(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Verificar acceso (cocinero solo ve sus propios turnos, admin ve todos)
    const wdCheck = await pool.query(
      `SELECT id, cook_user_id, status FROM shift_withdrawals WHERE id=$1`,
      [id]
    );
    if (!wdCheck.rows[0]) return res.status(404).json({ message: 'Turno no encontrado' });
    if (req.user?.role === 'cocina' && wdCheck.rows[0].cook_user_id !== req.user.id) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const result = await pool.query(`
      SELECT
        swi.id,
        swi.ingredient_id,
        i.name    AS ingredient_name,
        i.unit,
        swi.quantity_withdrawn,
        COALESCE(swi.quantity_remaining, 0) AS quantity_remaining,
        COALESCE(swi.quantity_withdrawn, 0) - COALESCE(swi.quantity_remaining, 0)
                  AS quantity_consumed,
        swi.created_at
      FROM shift_withdrawal_items swi
      JOIN ingredients i ON swi.ingredient_id = i.id
      WHERE swi.shift_withdrawal_id = $1
      ORDER BY i.name ASC
    `, [id]);

    const rows = result.rows.map((r) => {
      const withdrawn  = parseFloat(r.quantity_withdrawn);
      const remaining  = parseFloat(r.quantity_remaining);
      const consumed   = parseFloat(r.quantity_consumed);
      return {
        ...r,
        quantity_withdrawn: withdrawn,
        quantity_remaining: remaining,
        quantity_consumed:  consumed,
        mini_status:        calcMiniStatus(remaining, withdrawn),
      };
    });

    return res.json(rows);
  } catch (err) {
    console.error('[shift/items]', err);
    return res.status(500).json({ message: 'Error al obtener items del turno' });
  }
}

// ── POST /api/inventory/withdrawals/:id/restock ──────────────
// Reabastecimiento parcial sin cerrar el turno
export async function restockWithdrawal(req: AuthRequest, res: Response) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { items } = req.body as {
      items: Array<{ ingredient_id: string; quantity: number }>;
    };

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Debe incluir al menos un ingrediente' });
    }

    // Verificar que el turno existe y está abierto
    const wdCheck = await pool.query(
      `SELECT id, cook_user_id, status FROM shift_withdrawals WHERE id=$1`,
      [id]
    );
    if (!wdCheck.rows[0]) return res.status(404).json({ message: 'Turno no encontrado' });
    if (wdCheck.rows[0].status === 'cerrado') {
      return res.status(400).json({ message: 'No se puede reabastecer un turno cerrado' });
    }
    if (req.user?.role === 'cocina' && wdCheck.rows[0].cook_user_id !== req.user.id) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    await client.query('BEGIN');

    const updatedItems: unknown[] = [];

    for (const item of items) {
      if (!item.ingredient_id || item.quantity <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'ingredient_id y quantity > 0 son requeridos' });
      }

      // Verificar stock en bodega
      const ingR = await client.query(
        `SELECT id, name, stock_quantity, unit FROM ingredients WHERE id=$1 AND is_active=true FOR UPDATE`,
        [item.ingredient_id]
      );
      if (!ingR.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Ingrediente ${item.ingredient_id} no encontrado` });
      }

      const ing      = ingR.rows[0];
      const curStock = parseFloat(ing.stock_quantity);

      if (curStock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Stock insuficiente para "${ing.name}". Disponible: ${curStock} ${ing.unit}, solicitado: ${item.quantity}`,
        });
      }

      // Descontar de bodega
      const newBodegaStock = parseFloat((curStock - item.quantity).toFixed(3));
      await client.query(
        `UPDATE ingredients SET stock_quantity=$1, updated_at=NOW() WHERE id=$2`,
        [newBodegaStock, item.ingredient_id]
      );

      // Verificar si ya existe el ingrediente en el mini-inventario del turno
      const swiR = await client.query(
        `SELECT id, quantity_withdrawn, quantity_remaining FROM shift_withdrawal_items
         WHERE shift_withdrawal_id=$1 AND ingredient_id=$2`,
        [id, item.ingredient_id]
      );

      let newRemaining: number;

      if (swiR.rows[0]) {
        // Ya existe → sumar al restante
        const curRemaining = parseFloat(swiR.rows[0].quantity_remaining ?? '0');
        newRemaining = parseFloat((curRemaining + item.quantity).toFixed(3));
        const newWithdrawn = parseFloat(swiR.rows[0].quantity_withdrawn) + item.quantity;

        await client.query(
          `UPDATE shift_withdrawal_items
           SET quantity_remaining=$1, quantity_withdrawn=$2
           WHERE id=$3`,
          [newRemaining, newWithdrawn, swiR.rows[0].id]
        );
      } else {
        // No existe → crear nuevo ítem en el mini-inventario
        newRemaining = item.quantity;
        await client.query(`
          INSERT INTO shift_withdrawal_items
            (shift_withdrawal_id, ingredient_id, quantity_withdrawn, quantity_remaining)
          VALUES ($1,$2,$3,$4)
        `, [id, item.ingredient_id, item.quantity, item.quantity]);
      }

      // Registrar movimiento de salida de bodega
      await client.query(`
        INSERT INTO inventory_movements
          (ingredient_id, type, quantity, stock_after, user_id, shift_withdrawal_id, notes)
        VALUES ($1,'salida',$2,$3,$4,$5,'Reabastecimiento parcial de turno')
      `, [item.ingredient_id, -item.quantity, newBodegaStock, req.user?.id, id]);

      updatedItems.push({
        ingredient_id:      item.ingredient_id,
        ingredient_name:    ing.name,
        unit:               ing.unit,
        quantity_added:     item.quantity,
        quantity_remaining: newRemaining,
        mini_status:        calcMiniStatus(newRemaining, item.quantity),
      });
    }

    await client.query('COMMIT');

    // Emitir actualización en tiempo real a la pantalla del cocinero
    broadcast({
      type:    'inventory:stock_update',
      payload: { withdrawal_id: id, items: updatedItems },
    });

    return res.status(201).json({ withdrawal_id: id, items: updatedItems });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[shift/restock]', err);
    return res.status(500).json({ message: 'Error al reabastecer turno' });
  } finally {
    client.release();
  }
}

// ── POST /api/orders/items/:id/prepare ───────────────────────
// Marca un ítem como preparado y descuenta ingredientes del mini-inventario
export async function prepareOrderItem(req: AuthRequest, res: Response) {
  const client = await pool.connect();
  try {
    const { id: orderItemId } = req.params;
    const cookId = req.user!.id;

    // Obtener el ítem de orden con su menu_item_id
    const itemR = await client.query(
      `SELECT oi.id, oi.menu_item_id, oi.quantity, oi.status, mi.name AS item_name
       FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.id = $1`,
      [orderItemId]
    );
    if (!itemR.rows[0]) return res.status(404).json({ message: 'Ítem de orden no encontrado' });

    const orderItem = itemR.rows[0];

    // Buscar turno activo del cocinero
    const wdR = await client.query(
      `SELECT id FROM shift_withdrawals WHERE cook_user_id=$1 AND status='abierto' LIMIT 1`,
      [cookId]
    );
    if (!wdR.rows[0]) {
      return res.status(400).json({ message: 'No tienes un turno activo. Inicia un retiro de bodega primero.' });
    }
    const withdrawalId = wdR.rows[0].id as string;

    // Obtener receta del platillo
    const recipeR = await client.query(
      `SELECT ingredient_id, quantity_required FROM menu_item_ingredients WHERE menu_item_id=$1`,
      [orderItem.menu_item_id]
    );

    await client.query('BEGIN');

    const lowStockAlerts: Array<{ ingredient_name: string; remaining: number; unit: string }> = [];

    for (const ri of recipeR.rows) {
      const needed = parseFloat(ri.quantity_required) * orderItem.quantity;

      // Verificar stock en mini-inventario
      const swiR = await client.query(
        `SELECT swi.id, swi.quantity_remaining, i.name AS ingredient_name, i.unit
         FROM shift_withdrawal_items swi
         JOIN ingredients i ON swi.ingredient_id = i.id
         WHERE swi.shift_withdrawal_id=$1 AND swi.ingredient_id=$2
         FOR UPDATE`,
        [withdrawalId, ri.ingredient_id]
      );

      if (!swiR.rows[0]) {
        // El ingrediente no está en el mini-inventario — advertencia pero no bloquea
        console.warn(`[prepare] Ingrediente ${ri.ingredient_id} no en mini-inventario del turno`);
        continue;
      }

      const swi           = swiR.rows[0];
      const curRemaining  = parseFloat(swi.quantity_remaining ?? '0');
      const newRemaining  = Math.max(0, parseFloat((curRemaining - needed).toFixed(3)));

      // Actualizar mini-inventario
      await client.query(
        `UPDATE shift_withdrawal_items SET quantity_remaining=$1 WHERE id=$2`,
        [newRemaining, swi.id]
      );

      // Registrar movimiento de consumo
      await client.query(`
        INSERT INTO inventory_movements
          (ingredient_id, type, quantity, stock_after, user_id,
           shift_withdrawal_id, order_item_id, notes)
        VALUES ($1,'consumo_turno',$2,$3,$4,$5,$6,$7)
      `, [
        ri.ingredient_id,
        -needed,
        newRemaining,
        cookId,
        withdrawalId,
        orderItemId,
        `Consumo por preparación: ${orderItem.item_name} ×${orderItem.quantity}`,
      ]);

      // Detectar stock bajo para alertas
      const miniStatus = calcMiniStatus(newRemaining, curRemaining + needed);
      if (miniStatus === 'CRITICO' || miniStatus === 'AGOTADO') {
        lowStockAlerts.push({
          ingredient_name: swi.ingredient_name,
          remaining:       newRemaining,
          unit:            swi.unit,
        });
      }
    }

    await client.query('COMMIT');

    // Emitir actualización en tiempo real
    broadcast({
      type:    'inventory:stock_update',
      payload: { withdrawal_id: withdrawalId, order_item_id: orderItemId },
    });

    // Emitir alertas de stock crítico si las hay
    if (lowStockAlerts.length > 0) {
      broadcast({
        type:    'inventory:low_stock_alert',
        payload: { withdrawal_id: withdrawalId, alerts: lowStockAlerts },
      });
    }

    return res.json({ order_item_id: orderItemId, low_stock_alerts: lowStockAlerts });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[shift/prepare]', err);
    return res.status(500).json({ message: 'Error al registrar preparación' });
  } finally {
    client.release();
  }
}

// ── GET /api/inventory/withdrawals/:id/consumption ───────────
// Resumen de consumo del turno
export async function getConsumption(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        swi.ingredient_id,
        i.name    AS ingredient_name,
        i.unit,
        swi.quantity_withdrawn,
        COALESCE(swi.quantity_remaining, 0) AS quantity_remaining,
        COALESCE(swi.quantity_withdrawn, 0) - COALESCE(swi.quantity_remaining, 0)
                  AS quantity_consumed
      FROM shift_withdrawal_items swi
      JOIN ingredients i ON swi.ingredient_id = i.id
      WHERE swi.shift_withdrawal_id = $1
      ORDER BY quantity_consumed DESC
    `, [id]);

    return res.json(result.rows.map((r) => ({
      ...r,
      quantity_withdrawn: parseFloat(r.quantity_withdrawn),
      quantity_remaining: parseFloat(r.quantity_remaining),
      quantity_consumed:  parseFloat(r.quantity_consumed),
    })));
  } catch (err) {
    console.error('[shift/consumption]', err);
    return res.status(500).json({ message: 'Error al obtener consumo del turno' });
  }
}

// ── POST /api/inventory/withdrawals/:id/close — Cierre con liquidación ──
// Extiende el closeWithdrawal de F9: acepta devoluciones y mermas
export async function closeTurnWithLiquidation(req: AuthRequest, res: Response) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const cookId = req.user!.id;
    const { returns = [], mermas = [] } = req.body as {
      returns: Array<{ ingredient_id: string; quantity: number }>;
      mermas:  Array<{ ingredient_id: string; quantity: number; notes: string }>;
    };

    const wdCheck = await client.query(
      `SELECT id, status, cook_user_id FROM shift_withdrawals WHERE id=$1`,
      [id]
    );
    if (!wdCheck.rows[0]) return res.status(404).json({ message: 'Turno no encontrado' });
    if (wdCheck.rows[0].cook_user_id !== cookId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }
    if (wdCheck.rows[0].status === 'cerrado') {
      return res.status(400).json({ message: 'El turno ya está cerrado' });
    }

    await client.query('BEGIN');

    // Procesar devoluciones → restituir stock a bodega
    for (const ret of returns) {
      if (!ret.ingredient_id || ret.quantity <= 0) continue;

      await client.query(
        `UPDATE ingredients SET stock_quantity=stock_quantity+$1, updated_at=NOW() WHERE id=$2`,
        [ret.quantity, ret.ingredient_id]
      );
      const newStockR = await client.query(
        `SELECT stock_quantity FROM ingredients WHERE id=$1`, [ret.ingredient_id]
      );
      await client.query(`
        INSERT INTO inventory_movements
          (ingredient_id, type, quantity, stock_after, user_id, shift_withdrawal_id, notes)
        VALUES ($1,'entrada',$2,$3,$4,$5,'Devolución al cerrar turno')
      `, [ret.ingredient_id, ret.quantity, parseFloat(newStockR.rows[0]?.stock_quantity ?? '0'), cookId, id]);
    }

    // Procesar mermas → registrar como ajuste negativo
    for (const merma of mermas) {
      if (!merma.ingredient_id || merma.quantity <= 0) continue;
      const noteText = merma.notes?.trim() || 'Merma al cerrar turno';

      await client.query(`
        INSERT INTO inventory_movements
          (ingredient_id, type, quantity, stock_after, user_id, shift_withdrawal_id, notes)
        VALUES ($1,'ajuste',$2,NULL,$3,$4,$5)
      `, [merma.ingredient_id, -merma.quantity, cookId, id, noteText]);
    }

    // Cerrar el turno
    const result = await client.query(
      `UPDATE shift_withdrawals SET status='cerrado', closed_at=NOW() WHERE id=$1 RETURNING *`,
      [id]
    );

    await client.query('COMMIT');

    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[shift/close-liquidation]', err);
    return res.status(500).json({ message: 'Error al cerrar turno' });
  } finally {
    client.release();
  }
}

// ── GET /api/inventory/withdrawals/history ───────────────────
// Historial de turnos del cocinero (o todos si es admin)
export async function getWithdrawalHistory(req: AuthRequest, res: Response) {
  try {
    const isAdmin = req.user?.role === 'admin';
    const cookId  = req.user!.id;
    const { limit = '20' } = req.query;

    const result = await pool.query(`
      SELECT
        sw.id, sw.status, sw.started_at, sw.closed_at, sw.notes,
        u.first_name || ' ' || u.last_name AS cook_name,
        COUNT(swi.id) AS ingredient_count,
        ROUND(EXTRACT(EPOCH FROM (COALESCE(sw.closed_at, NOW()) - sw.started_at)) / 3600.0, 2)
          AS duration_hours
      FROM shift_withdrawals sw
      JOIN users u ON sw.cook_user_id = u.id
      LEFT JOIN shift_withdrawal_items swi ON swi.shift_withdrawal_id = sw.id
      ${isAdmin ? '' : 'WHERE sw.cook_user_id=$1'}
      GROUP BY sw.id, u.first_name, u.last_name
      ORDER BY sw.started_at DESC
      LIMIT $${isAdmin ? '1' : '2'}
    `, isAdmin ? [parseInt(String(limit))] : [cookId, parseInt(String(limit))]);

    return res.json(result.rows.map((r) => ({
      ...r,
      ingredient_count: parseInt(r.ingredient_count),
      duration_hours:   parseFloat(r.duration_hours),
    })));
  } catch (err) {
    console.error('[shift/history]', err);
    return res.status(500).json({ message: 'Error al obtener historial' });
  }
}

// ── GET /api/inventory/shifts/report — Reporte admin ─────────
export async function getShiftsReport(req: AuthRequest, res: Response) {
  try {
    const { from, to } = req.query;

    let dateFilter = '';
    const params: unknown[] = [];
    if (from) { params.push(from); dateFilter += ` AND sw.started_at >= $${params.length}::date`; }
    if (to)   { params.push(to);   dateFilter += ` AND sw.started_at < ($${params.length}::date + INTERVAL '1 day')`; }

    const result = await pool.query(`
      SELECT
        sw.id, sw.status, sw.started_at, sw.closed_at,
        u.first_name || ' ' || u.last_name AS cook_name,
        COUNT(DISTINCT swi.ingredient_id)  AS ingredients_used,
        COALESCE(SUM(
          COALESCE(swi.quantity_withdrawn,0) - COALESCE(swi.quantity_remaining,0)
        ), 0) AS total_consumed,
        COALESCE(SUM(swi.quantity_remaining), 0) AS total_remaining
      FROM shift_withdrawals sw
      JOIN users u ON sw.cook_user_id = u.id
      LEFT JOIN shift_withdrawal_items swi ON swi.shift_withdrawal_id = sw.id
      WHERE 1=1 ${dateFilter}
      GROUP BY sw.id, u.first_name, u.last_name
      ORDER BY sw.started_at DESC
    `, params);

    return res.json(result.rows.map((r) => ({
      ...r,
      ingredients_used: parseInt(r.ingredients_used),
      total_consumed:   parseFloat(r.total_consumed),
      total_remaining:  parseFloat(r.total_remaining),
    })));
  } catch (err) {
    console.error('[shifts/report]', err);
    return res.status(500).json({ message: 'Error al generar reporte' });
  }
}