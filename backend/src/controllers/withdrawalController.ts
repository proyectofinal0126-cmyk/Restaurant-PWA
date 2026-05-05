// ============================================================
// backend/src/controllers/withdrawalController.ts  —  Fase 9
//
// Gestiona los retiros de bodega por turno del cocinero.
// Un cocinero solo puede tener UN turno abierto a la vez.
// ============================================================

import { Response }    from 'express';
import pool            from '../utils/db';
import type { AuthRequest } from '../middleware/auth';

// ── POST /api/inventory/withdrawals ──────────────────────────
export async function createWithdrawal(req: AuthRequest, res: Response) {
  const client = await pool.connect();
  try {
    const cookId = req.user!.id;
    const { items, notes } = req.body as {
      items: Array<{ ingredient_id: string; quantity_withdrawn: number }>;
      notes?: string;
    };

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Debe incluir al menos un ingrediente en el retiro' });
    }

    // Verificar que no haya ya un turno abierto
    const existing = await client.query(
      `SELECT id FROM shift_withdrawals WHERE cook_user_id=$1 AND status='abierto' LIMIT 1`,
      [cookId]
    );
    if (existing.rows[0]) {
      return res.status(409).json({
        message: 'Ya tienes un turno abierto. Ciérralo antes de crear uno nuevo.',
        withdrawal_id: existing.rows[0].id,
      });
    }

    await client.query('BEGIN');

    // Crear el retiro de turno
    const wdResult = await client.query(`
      INSERT INTO shift_withdrawals (cook_user_id, notes)
      VALUES ($1, $2) RETURNING id, started_at, status
    `, [cookId, notes ?? null]);

    const withdrawalId = wdResult.rows[0].id as string;

    // Procesar cada item
    for (const item of items) {
      if (!item.ingredient_id || !item.quantity_withdrawn || item.quantity_withdrawn <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Cada item debe tener ingredient_id y quantity_withdrawn > 0' });
      }

      // Leer stock actual con lock
      const ingResult = await client.query(
        `SELECT id, name, stock_quantity, min_stock, unit
         FROM ingredients WHERE id=$1 AND is_active=true FOR UPDATE`,
        [item.ingredient_id]
      );

      if (!ingResult.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Ingrediente ${item.ingredient_id} no encontrado` });
      }

      const ing      = ingResult.rows[0];
      const curStock = parseFloat(ing.stock_quantity);

      if (curStock < item.quantity_withdrawn) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Stock insuficiente para "${ing.name}". Disponible: ${curStock} ${ing.unit}, solicitado: ${item.quantity_withdrawn}`,
        });
      }

      const newStock = parseFloat((curStock - item.quantity_withdrawn).toFixed(3));

      // Descontar stock
      await client.query(
        `UPDATE ingredients SET stock_quantity=$1, updated_at=NOW() WHERE id=$2`,
        [newStock, item.ingredient_id]
      );

      // Registrar item del retiro
      await client.query(`
        INSERT INTO shift_withdrawal_items
          (shift_withdrawal_id, ingredient_id, quantity_withdrawn, quantity_remaining)
        VALUES ($1,$2,$3,$4)
      `, [withdrawalId, item.ingredient_id, item.quantity_withdrawn, newStock]);

      // Registrar movimiento de salida
      await client.query(`
        INSERT INTO inventory_movements
          (ingredient_id, type, quantity, stock_after, user_id, shift_withdrawal_id, notes)
        VALUES ($1,'salida',$2,$3,$4,$5,'Retiro de turno')
      `, [item.ingredient_id, -item.quantity_withdrawn, newStock, cookId, withdrawalId]);

      // Si stock llegó a 0, marcar platillos relacionados como no disponibles
      if (newStock <= 0) {
        await client.query(`
          UPDATE menu_items SET is_available=false, updated_at=NOW()
          WHERE id IN (
            SELECT menu_item_id FROM menu_item_ingredients WHERE ingredient_id=$1
          )
        `, [item.ingredient_id]);
      }
    }

    await client.query('COMMIT');

    // Retornar el withdrawal con sus items
    const full = await pool.query(`
      SELECT sw.id, sw.cook_user_id, sw.started_at, sw.status, sw.notes,
             u.first_name || ' ' || u.last_name AS cook_name
      FROM shift_withdrawals sw JOIN users u ON sw.cook_user_id=u.id
      WHERE sw.id=$1
    `, [withdrawalId]);

    const itemsResult = await pool.query(`
      SELECT swi.id, swi.ingredient_id, i.name AS ingredient_name, i.unit,
             swi.quantity_withdrawn, swi.quantity_remaining, swi.created_at
      FROM shift_withdrawal_items swi JOIN ingredients i ON swi.ingredient_id=i.id
      WHERE swi.shift_withdrawal_id=$1
    `, [withdrawalId]);

    return res.status(201).json({
      ...full.rows[0],
      items: itemsResult.rows.map((r) => ({
        ...r,
        quantity_withdrawn: parseFloat(r.quantity_withdrawn),
        quantity_remaining: r.quantity_remaining ? parseFloat(r.quantity_remaining) : null,
      })),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[withdrawals/create]', err);
    return res.status(500).json({ message: 'Error al crear retiro de turno' });
  } finally {
    client.release();
  }
}

// ── GET /api/inventory/withdrawals/active ────────────────────
export async function getActiveWithdrawal(req: AuthRequest, res: Response) {
  try {
    const cookId = req.user!.id;

    const wdResult = await pool.query(`
      SELECT sw.id, sw.cook_user_id, sw.started_at, sw.status, sw.notes, sw.closed_at,
             u.first_name || ' ' || u.last_name AS cook_name
      FROM shift_withdrawals sw JOIN users u ON sw.cook_user_id=u.id
      WHERE sw.cook_user_id=$1 AND sw.status='abierto'
      ORDER BY sw.started_at DESC LIMIT 1
    `, [cookId]);

    if (!wdResult.rows[0]) {
      return res.json(null);  // Sin turno activo — respuesta vacía es OK
    }

    const wd = wdResult.rows[0];

    const itemsResult = await pool.query(`
      SELECT swi.id, swi.ingredient_id, i.name AS ingredient_name, i.unit,
             swi.quantity_withdrawn, swi.quantity_remaining, swi.created_at
      FROM shift_withdrawal_items swi
      JOIN ingredients i ON swi.ingredient_id = i.id
      WHERE swi.shift_withdrawal_id = $1
      ORDER BY i.name
    `, [wd.id]);

    return res.json({
      ...wd,
      items: itemsResult.rows.map((r) => ({
        ...r,
        quantity_withdrawn: parseFloat(r.quantity_withdrawn),
        quantity_remaining: r.quantity_remaining ? parseFloat(r.quantity_remaining) : null,
      })),
    });
  } catch (err) {
    console.error('[withdrawals/active]', err);
    return res.status(500).json({ message: 'Error al obtener turno activo' });
  }
}

// ── POST /api/inventory/withdrawals/:id/close ────────────────
export async function closeWithdrawal(req: AuthRequest, res: Response) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const cookId = req.user!.id;

    // Verificar que el turno pertenece al cocinero autenticado
    const check = await client.query(
      `SELECT id, status FROM shift_withdrawals WHERE id=$1 AND cook_user_id=$2`,
      [id, cookId]
    );
    if (!check.rows[0]) {
      return res.status(404).json({ message: 'Turno no encontrado o no autorizado' });
    }
    if (check.rows[0].status === 'cerrado') {
      return res.status(400).json({ message: 'Este turno ya está cerrado' });
    }

    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE shift_withdrawals
      SET status='cerrado', closed_at=NOW()
      WHERE id=$1 RETURNING *
    `, [id]);

    await client.query('COMMIT');

    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[withdrawals/close]', err);
    return res.status(500).json({ message: 'Error al cerrar turno' });
  } finally {
    client.release();
  }
}