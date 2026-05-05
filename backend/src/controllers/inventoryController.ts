// ============================================================
// backend/src/controllers/inventoryController.ts  —  Fase 9
//
// Gestiona: ingredientes, proveedores, entradas, ajustes,
// movimientos e historial de bodega.
// Todos los endpoints requieren autenticación JWT.
// Admin: CRUD completo. Cocinero: solo lectura + retiros.
// ============================================================

import { Response }    from 'express';
import pool            from '../utils/db';
import type { AuthRequest } from '../middleware/auth';

// ── Utilidades ────────────────────────────────────────────────
function calcStockStatus(stock: number, min: number): string {
  if (stock <= 0)           return 'AGOTADO';
  if (stock < min)          return 'CRITICO';
  if (stock <= min * 1.5)   return 'BAJO';
  return 'OK';
}

// ── GET /api/inventory/ingredients ──────────────────────────
export async function getIngredients(req: AuthRequest, res: Response) {
  try {
    const { search, status, supplier_id, active = 'true' } = req.query;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (active !== 'all') {
      params.push(active === 'true');
      conditions.push(`i.is_active = $${params.length}`);
    }
    if (supplier_id) {
      params.push(supplier_id);
      conditions.push(`i.supplier_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${String(search).toLowerCase()}%`);
      conditions.push(`LOWER(i.name) LIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        i.id, i.name, i.unit, i.stock_quantity, i.min_stock,
        i.cost_per_unit, i.supplier_id, i.is_active,
        i.created_at, i.updated_at,
        s.name AS supplier_name
      FROM ingredients i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      ${where}
      ORDER BY i.name ASC
    `, params);

    const rows = result.rows.map((r) => ({
      ...r,
      stock_quantity: parseFloat(r.stock_quantity),
      min_stock:      parseFloat(r.min_stock),
      cost_per_unit:  parseFloat(r.cost_per_unit),
      status:         calcStockStatus(parseFloat(r.stock_quantity), parseFloat(r.min_stock)),
    }));

    // Filtro por status (calculado)
    const filtered = status ? rows.filter((r) => r.status === String(status).toUpperCase()) : rows;

    return res.json(filtered);
  } catch (err) {
    console.error('[inventory/ingredients/get]', err);
    return res.status(500).json({ message: 'Error al obtener ingredientes' });
  }
}

// ── POST /api/inventory/ingredients ─────────────────────────
export async function createIngredient(req: AuthRequest, res: Response) {
  try {
    const { name, unit, stock_quantity = 0, min_stock = 0, cost_per_unit = 0, supplier_id } = req.body as {
      name: string; unit: string; stock_quantity?: number;
      min_stock?: number; cost_per_unit?: number; supplier_id?: string;
    };

    if (!name?.trim() || !unit?.trim()) {
      return res.status(400).json({ message: 'nombre y unidad son requeridos' });
    }
    if (stock_quantity < 0 || min_stock < 0 || cost_per_unit < 0) {
      return res.status(400).json({ message: 'Los valores numéricos no pueden ser negativos' });
    }

    const result = await pool.query(`
      INSERT INTO ingredients (name, unit, stock_quantity, min_stock, cost_per_unit, supplier_id)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [name.trim(), unit.trim(), stock_quantity, min_stock, cost_per_unit, supplier_id ?? null]);

    const r = result.rows[0];

    // Registrar movimiento inicial si viene con stock
    if (stock_quantity > 0) {
      await pool.query(`
        INSERT INTO inventory_movements
          (ingredient_id, type, quantity, stock_after, user_id, notes)
        VALUES ($1,'entrada',$2,$3,$4,'Stock inicial al crear ingrediente')
      `, [r.id, stock_quantity, stock_quantity, req.user?.id ?? null]);
    }

    return res.status(201).json({
      ...r,
      stock_quantity: parseFloat(r.stock_quantity),
      min_stock:      parseFloat(r.min_stock),
      cost_per_unit:  parseFloat(r.cost_per_unit),
      status:         calcStockStatus(parseFloat(r.stock_quantity), parseFloat(r.min_stock)),
      supplier_name:  null,
    });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code === '23505') {
      return res.status(409).json({ message: 'Ya existe un ingrediente con ese nombre' });
    }
    console.error('[inventory/ingredients/create]', err);
    return res.status(500).json({ message: 'Error al crear ingrediente' });
  }
}

// ── PUT /api/inventory/ingredients/:id ──────────────────────
export async function updateIngredient(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, unit, min_stock, cost_per_unit, supplier_id, is_active } = req.body as {
      name?: string; unit?: string; min_stock?: number;
      cost_per_unit?: number; supplier_id?: string; is_active?: boolean;
    };

    const result = await pool.query(`
      UPDATE ingredients
      SET name          = COALESCE($1, name),
          unit          = COALESCE($2, unit),
          min_stock     = COALESCE($3, min_stock),
          cost_per_unit = COALESCE($4, cost_per_unit),
          supplier_id   = COALESCE($5, supplier_id),
          is_active     = COALESCE($6, is_active),
          updated_at    = NOW()
      WHERE id = $7
      RETURNING *
    `, [name ?? null, unit ?? null, min_stock ?? null, cost_per_unit ?? null,
        supplier_id ?? null, is_active ?? null, id]);

    if (!result.rows[0]) return res.status(404).json({ message: 'Ingrediente no encontrado' });

    const r = result.rows[0];
    const supR = r.supplier_id
      ? await pool.query('SELECT name FROM suppliers WHERE id=$1', [r.supplier_id])
      : { rows: [] };

    return res.json({
      ...r,
      stock_quantity: parseFloat(r.stock_quantity),
      min_stock:      parseFloat(r.min_stock),
      cost_per_unit:  parseFloat(r.cost_per_unit),
      status:         calcStockStatus(parseFloat(r.stock_quantity), parseFloat(r.min_stock)),
      supplier_name:  supR.rows[0]?.name ?? null,
    });
  } catch (err) {
    console.error('[inventory/ingredients/update]', err);
    return res.status(500).json({ message: 'Error al actualizar ingrediente' });
  }
}

// ── DELETE /api/inventory/ingredients/:id (soft delete) ─────
export async function deleteIngredient(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE ingredients SET is_active=false, updated_at=NOW() WHERE id=$1 RETURNING id`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Ingrediente no encontrado' });
    return res.status(204).send();
  } catch (err) {
    console.error('[inventory/ingredients/delete]', err);
    return res.status(500).json({ message: 'Error al desactivar ingrediente' });
  }
}

// ── POST /api/inventory/entries — Entrada de mercancía ───────
export async function registerEntry(req: AuthRequest, res: Response) {
  const client = await pool.connect();
  try {
    const { ingredient_id, quantity, notes } = req.body as {
      ingredient_id: string; quantity: number; notes?: string;
    };

    if (!ingredient_id || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'ingredient_id y quantity > 0 son requeridos' });
    }

    await client.query('BEGIN');

    const upd = await client.query(`
      UPDATE ingredients
      SET stock_quantity = stock_quantity + $1, updated_at = NOW()
      WHERE id = $2 AND is_active = true
      RETURNING id, stock_quantity, min_stock
    `, [quantity, ingredient_id]);

    if (!upd.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Ingrediente no encontrado o inactivo' });
    }

    const newStock = parseFloat(upd.rows[0].stock_quantity);

    await client.query(`
      INSERT INTO inventory_movements
        (ingredient_id, type, quantity, stock_after, user_id, notes)
      VALUES ($1,'entrada',$2,$3,$4,$5)
    `, [ingredient_id, quantity, newStock, req.user?.id ?? null, notes ?? null]);

    await client.query('COMMIT');

    return res.status(201).json({
      ingredient_id,
      new_stock: newStock,
      status:    calcStockStatus(newStock, parseFloat(upd.rows[0].min_stock)),
      message:   `Entrada registrada. Stock actualizado a ${newStock} ${upd.rows[0].unit ?? ''}`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[inventory/entries]', err);
    return res.status(500).json({ message: 'Error al registrar entrada' });
  } finally {
    client.release();
  }
}

// ── POST /api/inventory/adjustments — Ajuste manual ─────────
export async function registerAdjustment(req: AuthRequest, res: Response) {
  const client = await pool.connect();
  try {
    const { ingredient_id, quantity, notes } = req.body as {
      ingredient_id: string; quantity: number; notes: string;
    };

    if (!ingredient_id || quantity === undefined || quantity === 0) {
      return res.status(400).json({ message: 'ingredient_id y quantity (≠0) son requeridos' });
    }
    if (!notes?.trim()) {
      return res.status(400).json({ message: 'La justificación (notes) es obligatoria para ajustes' });
    }

    await client.query('BEGIN');

    const upd = await client.query(`
      UPDATE ingredients
      SET stock_quantity = GREATEST(0, stock_quantity + $1), updated_at = NOW()
      WHERE id = $2 AND is_active = true
      RETURNING id, stock_quantity, min_stock
    `, [quantity, ingredient_id]);

    if (!upd.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Ingrediente no encontrado' });
    }

    const newStock = parseFloat(upd.rows[0].stock_quantity);

    await client.query(`
      INSERT INTO inventory_movements
        (ingredient_id, type, quantity, stock_after, user_id, notes)
      VALUES ($1,'ajuste',$2,$3,$4,$5)
    `, [ingredient_id, quantity, newStock, req.user?.id ?? null, notes.trim()]);

    await client.query('COMMIT');

    return res.status(201).json({
      ingredient_id,
      new_stock: newStock,
      status:    calcStockStatus(newStock, parseFloat(upd.rows[0].min_stock)),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[inventory/adjustments]', err);
    return res.status(500).json({ message: 'Error al registrar ajuste' });
  } finally {
    client.release();
  }
}

// ── GET /api/inventory/movements — Historial ─────────────────
export async function getMovements(req: AuthRequest, res: Response) {
  try {
    const { ingredient_id, type, date_from, date_to, limit = '100' } = req.query;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (ingredient_id) {
      params.push(ingredient_id);
      conditions.push(`m.ingredient_id = $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`m.type = $${params.length}`);
    }
    if (date_from) {
      params.push(date_from);
      conditions.push(`m.created_at >= $${params.length}::date`);
    }
    if (date_to) {
      params.push(date_to);
      conditions.push(`m.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    // Cocinero solo ve sus propios movimientos
    if (req.user?.role === 'cocina') {
      params.push(req.user.id);
      conditions.push(`m.user_id = $${params.length}`);
    }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const maxRows = Math.min(parseInt(String(limit)) || 100, 500);

    const result = await pool.query(`
      SELECT
        m.id, m.ingredient_id, i.name AS ingredient_name, i.unit,
        m.type, m.quantity, m.stock_after,
        m.user_id,
        CASE WHEN u.first_name IS NOT NULL
             THEN u.first_name || ' ' || u.last_name ELSE NULL END AS user_name,
        m.shift_withdrawal_id, m.notes, m.created_at
      FROM inventory_movements m
      JOIN ingredients i ON m.ingredient_id = i.id
      LEFT JOIN users u  ON m.user_id = u.id
      ${where}
      ORDER BY m.created_at DESC
      LIMIT ${maxRows}
    `, params);

    return res.json(result.rows.map((r) => ({
      ...r,
      quantity:    parseFloat(r.quantity),
      stock_after: r.stock_after ? parseFloat(r.stock_after) : null,
    })));
  } catch (err) {
    console.error('[inventory/movements]', err);
    return res.status(500).json({ message: 'Error al obtener movimientos' });
  }
}

// ── GET /api/inventory/low-stock ─────────────────────────────
export async function getLowStock(_req: AuthRequest, res: Response) {
  try {
    const result = await pool.query(`
      SELECT i.id, i.name, i.unit, i.stock_quantity, i.min_stock,
             s.name AS supplier_name
      FROM ingredients i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.is_active = true
        AND i.stock_quantity <= i.min_stock * 1.5
      ORDER BY (i.stock_quantity / NULLIF(i.min_stock, 0)) ASC
    `);

    return res.json(result.rows.map((r) => ({
      ...r,
      stock_quantity: parseFloat(r.stock_quantity),
      min_stock:      parseFloat(r.min_stock),
      status:         calcStockStatus(parseFloat(r.stock_quantity), parseFloat(r.min_stock)),
    })));
  } catch (err) {
    console.error('[inventory/low-stock]', err);
    return res.status(500).json({ message: 'Error al obtener alertas de stock' });
  }
}

// ── GET /api/suppliers ───────────────────────────────────────
export async function getSuppliers(_req: AuthRequest, res: Response) {
  try {
    const result = await pool.query(`
      SELECT id, name, contact_name, phone, email, address, is_active, created_at, updated_at
      FROM suppliers WHERE is_active = true ORDER BY name ASC
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('[suppliers/get]', err);
    return res.status(500).json({ message: 'Error al obtener proveedores' });
  }
}

// ── POST /api/suppliers ──────────────────────────────────────
export async function createSupplier(req: AuthRequest, res: Response) {
  try {
    const { name, contact_name, phone, email, address } = req.body as {
      name: string; contact_name?: string; phone?: string; email?: string; address?: string;
    };
    if (!name?.trim()) return res.status(400).json({ message: 'El nombre del proveedor es requerido' });

    const result = await pool.query(`
      INSERT INTO suppliers (name, contact_name, phone, email, address)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [name.trim(), contact_name ?? null, phone ?? null, email ?? null, address ?? null]);

    return res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code === '23505') {
      return res.status(409).json({ message: 'Ya existe un proveedor con ese nombre' });
    }
    console.error('[suppliers/create]', err);
    return res.status(500).json({ message: 'Error al crear proveedor' });
  }
}

// ── PUT /api/suppliers/:id ───────────────────────────────────
export async function updateSupplier(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, contact_name, phone, email, address, is_active } = req.body as {
      name?: string; contact_name?: string; phone?: string;
      email?: string; address?: string; is_active?: boolean;
    };

    const result = await pool.query(`
      UPDATE suppliers
      SET name         = COALESCE($1, name),
          contact_name = COALESCE($2, contact_name),
          phone        = COALESCE($3, phone),
          email        = COALESCE($4, email),
          address      = COALESCE($5, address),
          is_active    = COALESCE($6, is_active),
          updated_at   = NOW()
      WHERE id = $7 RETURNING *
    `, [name ?? null, contact_name ?? null, phone ?? null,
        email ?? null, address ?? null, is_active ?? null, id]);

    if (!result.rows[0]) return res.status(404).json({ message: 'Proveedor no encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[suppliers/update]', err);
    return res.status(500).json({ message: 'Error al actualizar proveedor' });
  }
}

// ── GET /api/recipes/menu-item/:id ───────────────────────────
export async function getRecipe(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT mii.id, mii.menu_item_id, mi.name AS menu_item_name,
             mii.ingredient_id, i.name AS ingredient_name, i.unit,
             mii.quantity_required
      FROM menu_item_ingredients mii
      JOIN menu_items mi   ON mii.menu_item_id  = mi.id
      JOIN ingredients i   ON mii.ingredient_id = i.id
      WHERE mii.menu_item_id = $1
      ORDER BY i.name
    `, [id]);
    return res.json(result.rows.map((r) => ({
      ...r, quantity_required: parseFloat(r.quantity_required),
    })));
  } catch (err) {
    console.error('[recipes/get]', err);
    return res.status(500).json({ message: 'Error al obtener receta' });
  }
}

// ── POST /api/recipes/menu-item/:id ──────────────────────────
export async function addRecipeIngredient(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { ingredient_id, quantity_required } = req.body as {
      ingredient_id: string; quantity_required: number;
    };

    if (!ingredient_id || !quantity_required || quantity_required <= 0) {
      return res.status(400).json({ message: 'ingredient_id y quantity_required > 0 son requeridos' });
    }

    const result = await pool.query(`
      INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_required)
      VALUES ($1,$2,$3)
      ON CONFLICT (menu_item_id, ingredient_id)
      DO UPDATE SET quantity_required = EXCLUDED.quantity_required
      RETURNING *
    `, [id, ingredient_id, quantity_required]);

    return res.status(201).json({
      ...result.rows[0],
      quantity_required: parseFloat(result.rows[0].quantity_required),
    });
  } catch (err) {
    console.error('[recipes/add]', err);
    return res.status(500).json({ message: 'Error al agregar ingrediente a receta' });
  }
}

// ── DELETE /api/recipes/menu-item/:id/ingredient/:iid ────────
export async function removeRecipeIngredient(req: AuthRequest, res: Response) {
  try {
    const { id, iid } = req.params;
    await pool.query(
      `DELETE FROM menu_item_ingredients WHERE menu_item_id=$1 AND ingredient_id=$2`,
      [id, iid]
    );
    return res.status(204).send();
  } catch (err) {
    console.error('[recipes/remove]', err);
    return res.status(500).json({ message: 'Error al eliminar ingrediente de receta' });
  }
}