// ============================================================
// backend/src/controllers/adminController.ts  —  Fase 8
//
// Controladores del Admin Dashboard.
// Todos requieren rol 'admin' (verificado en la ruta).
// ============================================================

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool   from '../utils/db';
import type { AuthRequest } from '../middleware/auth';

// ── GET /api/admin/stats ─────────────────────────────────────
export async function getStats(_req: Request, res: Response) {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [ordersR, topTableR, topItemR, topWaiterR, byHourR, byCatR, bySourceR] =
      await Promise.all([
        // Órdenes del día
        pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE status = 'completed')  AS orders,
            COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0) AS revenue,
            COALESCE(AVG(total) FILTER (WHERE status = 'completed'), 0) AS avg_ticket,
            COUNT(*) FILTER (WHERE status = 'cancelled')  AS cancelled
          FROM orders
          WHERE DATE(created_at AT TIME ZONE 'America/Bogota') = $1
        `, [today]),

        // Mesa top
        pool.query(`
          SELECT t.number, t.section, COUNT(o.id) AS orders
          FROM orders o JOIN tables t ON o.table_id = t.id
          WHERE DATE(o.created_at AT TIME ZONE 'America/Bogota') = $1
            AND o.status = 'completed'
          GROUP BY t.id, t.number, t.section
          ORDER BY orders DESC LIMIT 1
        `, [today]),

        // Ítem más pedido
        pool.query(`
          SELECT mi.name, mc.name AS category, SUM(oi.quantity) AS qty
          FROM order_items oi
          JOIN orders o        ON oi.order_id = o.id
          JOIN menu_items mi   ON oi.menu_item_id = mi.id
          JOIN menu_categories mc ON mi.category_id = mc.id
          WHERE DATE(o.created_at AT TIME ZONE 'America/Bogota') = $1
            AND o.status = 'completed'
          GROUP BY mi.id, mi.name, mc.name
          ORDER BY qty DESC LIMIT 1
        `, [today]),

        // Mesero top
        pool.query(`
          SELECT u.first_name || ' ' || u.last_name AS name, COUNT(o.id) AS orders
          FROM orders o JOIN users u ON o.waiter_id = u.id
          WHERE DATE(o.created_at AT TIME ZONE 'America/Bogota') = $1
            AND o.status = 'completed'
          GROUP BY u.id, u.first_name, u.last_name
          ORDER BY orders DESC LIMIT 1
        `, [today]),

        // Por hora
        pool.query(`
          SELECT
            EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Bogota') AS hour,
            COUNT(*) AS orders,
            COALESCE(SUM(total), 0) AS revenue
          FROM orders
          WHERE DATE(created_at AT TIME ZONE 'America/Bogota') = $1
            AND status = 'completed'
          GROUP BY hour ORDER BY hour
        `, [today]),

        // Por categoría
        pool.query(`
          SELECT mc.name AS category, SUM(oi.quantity) AS qty,
                 COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          JOIN menu_items mi ON oi.menu_item_id = mi.id
          JOIN menu_categories mc ON mi.category_id = mc.id
          WHERE DATE(o.created_at AT TIME ZONE 'America/Bogota') = $1
            AND o.status = 'completed'
          GROUP BY mc.id, mc.name ORDER BY revenue DESC
        `, [today]),

        // Por fuente
        pool.query(`
          SELECT source, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
          FROM orders
          WHERE DATE(created_at AT TIME ZONE 'America/Bogota') = $1
            AND status = 'completed'
          GROUP BY source
        `, [today]),
      ]);

    const today_data = ordersR.rows[0];
    const topTable   = topTableR.rows[0] ?? { number: null, section: null, orders: 0 };
    const topItem    = topItemR.rows[0]  ?? { name: null, category: null, qty: 0 };
    const topWaiter  = topWaiterR.rows[0] ?? { name: null, orders: 0 };

    return res.json({
      today: {
        orders:           parseInt(today_data.orders),
        revenue:          parseFloat(today_data.revenue),
        avgTicket:        parseFloat(today_data.avg_ticket),
        cancelledOrders:  parseInt(today_data.cancelled),
      },
      topTable:  { number: topTable.number, section: topTable.section, orders: parseInt(topTable.orders) },
      topItem:   { name: topItem.name, category: topItem.category, qty: parseInt(topItem.qty ?? '0') },
      topWaiter: { name: topWaiter.name, orders: parseInt(topWaiter.orders ?? '0') },
      byHour:    byHourR.rows.map((r) => ({ hour: parseInt(r.hour), orders: parseInt(r.orders), revenue: parseFloat(r.revenue) })),
      byCategory:byCatR.rows.map((r) => ({ category: r.category, qty: parseInt(r.qty), revenue: parseFloat(r.revenue) })),
      bySource:  bySourceR.rows.map((r) => ({ source: r.source, orders: parseInt(r.orders), revenue: parseFloat(r.revenue) })),
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    return res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
}

// ── GET /api/admin/reports ───────────────────────────────────
export async function getReports(req: Request, res: Response) {
  try {
    const { from = '', to = '', source = 'all' } = req.query;
    if (!from || !to) return res.status(400).json({ message: 'from y to son requeridos' });

    const sourceFilter = source !== 'all' ? `AND o.source = '${source}'` : '';

    const [summaryR, byDayR, topItemsR, topWaitersR, peakR, timingsR] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'completed') AS total_orders,
          COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0) AS total_revenue,
          COALESCE(SUM(tip)   FILTER (WHERE status = 'completed'), 0) AS total_tips,
          COALESCE(AVG(total) FILTER (WHERE status = 'completed'), 0) AS avg_ticket,
          ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0), 1) AS completion_rate
        FROM orders o
        WHERE DATE(o.created_at AT TIME ZONE 'America/Bogota') BETWEEN $1 AND $2 ${sourceFilter}
      `, [from, to]),

      pool.query(`
        SELECT DATE(created_at AT TIME ZONE 'America/Bogota') AS date,
               COUNT(*) AS orders,
               COALESCE(SUM(total), 0) AS revenue,
               COALESCE(SUM(tip), 0)   AS tips
        FROM orders o
        WHERE DATE(created_at AT TIME ZONE 'America/Bogota') BETWEEN $1 AND $2
          AND status = 'completed' ${sourceFilter}
        GROUP BY date ORDER BY date
      `, [from, to]),

      pool.query(`
        SELECT mi.name, mc.name AS category,
               SUM(oi.quantity) AS qty,
               SUM(oi.price * oi.quantity) AS revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        JOIN menu_categories mc ON mi.category_id = mc.id
        WHERE DATE(o.created_at AT TIME ZONE 'America/Bogota') BETWEEN $1 AND $2
          AND o.status = 'completed' ${sourceFilter}
        GROUP BY mi.id, mi.name, mc.name
        ORDER BY qty DESC LIMIT 10
      `, [from, to]),

      pool.query(`
        SELECT u.first_name || ' ' || u.last_name AS name,
               COUNT(o.id) AS orders,
               COALESCE(SUM(o.total), 0) AS revenue,
               ROUND(AVG(EXTRACT(EPOCH FROM (o.completed_at - o.created_at)) / 60), 1) AS avg_time
        FROM orders o JOIN users u ON o.waiter_id = u.id
        WHERE DATE(o.created_at AT TIME ZONE 'America/Bogota') BETWEEN $1 AND $2
          AND o.status = 'completed'
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY revenue DESC
      `, [from, to]),

      pool.query(`
        SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Bogota') AS hour,
               COUNT(*) AS orders,
               COALESCE(SUM(total), 0) AS revenue
        FROM orders o
        WHERE DATE(o.created_at AT TIME ZONE 'America/Bogota') BETWEEN $1 AND $2
          AND o.status = 'completed' ${sourceFilter}
        GROUP BY hour ORDER BY hour
      `, [from, to]),

      pool.query(`
        SELECT
          ROUND(AVG(time_to_kitchen_secs)  / 60.0, 1) AS to_kitchen,
          ROUND(AVG(time_to_ready_secs)    / 60.0, 1) AS preparation,
          ROUND(AVG(time_total_secs)       / 60.0, 1) AS total
        FROM order_timings
        WHERE DATE(created_at) BETWEEN $1 AND $2
      `, [from, to]),
    ]);

    const s = summaryR.rows[0];
    const t = timingsR.rows[0] ?? {};

    return res.json({
      from, to,
      summary: {
        totalOrders:    parseInt(s.total_orders),
        totalRevenue:   parseFloat(s.total_revenue),
        totalTips:      parseFloat(s.total_tips),
        avgTicket:      parseFloat(s.avg_ticket),
        completionRate: parseFloat(s.completion_rate ?? '0'),
      },
      byDay:       byDayR.rows.map((r) => ({ date: r.date, orders: parseInt(r.orders), revenue: parseFloat(r.revenue), tips: parseFloat(r.tips) })),
      topItems:    topItemsR.rows.map((r) => ({ name: r.name, category: r.category, qty: parseInt(r.qty), revenue: parseFloat(r.revenue) })),
      topWaiters:  topWaitersR.rows.map((r) => ({ name: r.name, orders: parseInt(r.orders), revenue: parseFloat(r.revenue), avgTime: r.avg_time ? parseFloat(r.avg_time) : null })),
      peakHours:   peakR.rows.map((r) => ({ hour: parseInt(r.hour), orders: parseInt(r.orders), revenue: parseFloat(r.revenue) })),
      avgTimings: {
        toKitchen:   t.to_kitchen   ? parseFloat(t.to_kitchen)   : null,
        preparation: t.preparation  ? parseFloat(t.preparation)  : null,
        total:       t.total        ? parseFloat(t.total)        : null,
      },
    });
  } catch (err) {
    console.error('[admin/reports]', err);
    return res.status(500).json({ message: 'Error al generar reporte' });
  }
}

// ── CRUD Categorías ──────────────────────────────────────────
export async function getAdminCategories(_req: Request, res: Response) {
  try {
    const result = await pool.query(`
      SELECT mc.id, mc.name, mc.description, mc.icon, mc.image_url,
             mc.position, mc.is_active, mc.created_at,
             COUNT(mi.id) AS items_count
      FROM menu_categories mc
      LEFT JOIN menu_items mi ON mi.category_id = mc.id
      GROUP BY mc.id
      ORDER BY mc.position, mc.name
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('[admin/categories/get]', err);
    return res.status(500).json({ message: 'Error al obtener categorías' });
  }
}

export async function createCategory(req: Request, res: Response) {
  try {
    const { name, description, icon, position, is_active } = req.body;
    if (!name) return res.status(400).json({ message: 'El nombre es requerido' });

    const result = await pool.query(
      `INSERT INTO menu_categories (name, description, icon, position, is_active)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, description ?? null, icon ?? null, position ?? 99, is_active ?? true]
    );
    return res.status(201).json({ ...result.rows[0], items_count: 0 });
  } catch (err) {
    console.error('[admin/categories/create]', err);
    return res.status(500).json({ message: 'Error al crear categoría' });
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, icon, position, is_active } = req.body;

    const result = await pool.query(
      `UPDATE menu_categories
       SET name=$1, description=$2, icon=$3, position=$4, is_active=$5
       WHERE id=$6 RETURNING *`,
      [name, description ?? null, icon ?? null, position ?? 99, is_active ?? true, id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Categoría no encontrada' });

    const countR = await pool.query('SELECT COUNT(*) FROM menu_items WHERE category_id=$1', [id]);
    return res.json({ ...result.rows[0], items_count: parseInt(countR.rows[0].count) });
  } catch (err) {
    console.error('[admin/categories/update]', err);
    return res.status(500).json({ message: 'Error al actualizar categoría' });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const count = await pool.query('SELECT COUNT(*) FROM menu_items WHERE category_id=$1', [id]);
    if (parseInt(count.rows[0].count) > 0) {
      return res.status(400).json({ message: 'No se puede eliminar: tiene ítems asociados. Elimínalos primero.' });
    }
    await pool.query('DELETE FROM menu_categories WHERE id=$1', [id]);
    return res.status(204).send();
  } catch (err) {
    console.error('[admin/categories/delete]', err);
    return res.status(500).json({ message: 'Error al eliminar categoría' });
  }
}

// ── CRUD Items ───────────────────────────────────────────────
export async function getAdminItems(req: Request, res: Response) {
  try {
    const { category } = req.query;
    const params: string[] = [];
    let where = '';
    if (category) { params.push(String(category)); where = `WHERE mi.category_id = $${params.length}`; }

    const result = await pool.query(`
      SELECT mi.*, mc.name AS category_name,
             COUNT(oi.id) AS orders_count
      FROM menu_items mi
      JOIN menu_categories mc ON mi.category_id = mc.id
      LEFT JOIN order_items oi ON oi.menu_item_id = mi.id
      ${where}
      GROUP BY mi.id, mc.name
      ORDER BY mc.name, mi.name
    `, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[admin/items/get]', err);
    return res.status(500).json({ message: 'Error al obtener ítems' });
  }
}

export async function createMenuItem(req: Request, res: Response) {
  try {
    const { category_id, name, description, price, preparation_time, is_available, is_out_of_stock } = req.body;
    if (!name || !category_id || !price) return res.status(400).json({ message: 'Faltan campos requeridos' });

    const result = await pool.query(
      `INSERT INTO menu_items (category_id, name, description, price, preparation_time, is_available, is_out_of_stock)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [category_id, name, description ?? null, price, preparation_time ?? 10, is_available ?? true, is_out_of_stock ?? false]
    );
    const catR = await pool.query('SELECT name FROM menu_categories WHERE id=$1', [category_id]);
    return res.status(201).json({ ...result.rows[0], category_name: catR.rows[0]?.name, orders_count: 0 });
  } catch (err) {
    console.error('[admin/items/create]', err);
    return res.status(500).json({ message: 'Error al crear ítem' });
  }
}

export async function updateMenuItem(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { category_id, name, description, price, preparation_time, is_available, is_out_of_stock } = req.body;

    const result = await pool.query(
      `UPDATE menu_items
       SET category_id=$1, name=$2, description=$3, price=$4,
           preparation_time=$5, is_available=$6, is_out_of_stock=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [category_id, name, description ?? null, price, preparation_time ?? 10, is_available, is_out_of_stock, id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Ítem no encontrado' });

    const catR   = await pool.query('SELECT name FROM menu_categories WHERE id=$1', [category_id]);
    const countR = await pool.query('SELECT COUNT(*) FROM order_items WHERE menu_item_id=$1', [id]);
    return res.json({ ...result.rows[0], category_name: catR.rows[0]?.name, orders_count: parseInt(countR.rows[0].count) });
  } catch (err) {
    console.error('[admin/items/update]', err);
    return res.status(500).json({ message: 'Error al actualizar ítem' });
  }
}

export async function deleteMenuItem(req: Request, res: Response) {
  try {
    await pool.query('DELETE FROM menu_items WHERE id=$1', [req.params.id]);
    return res.status(204).send();
  } catch (err) {
    console.error('[admin/items/delete]', err);
    return res.status(500).json({ message: 'Error al eliminar ítem' });
  }
}

export async function toggleItemAvailability(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { is_available } = req.body;
    const result = await pool.query(
      `UPDATE menu_items SET is_available=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [is_available, id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Ítem no encontrado' });
    const catR = await pool.query('SELECT name FROM menu_categories WHERE id=$1', [result.rows[0].category_id]);
    return res.json({ ...result.rows[0], category_name: catR.rows[0]?.name });
  } catch (err) {
    console.error('[admin/items/toggle]', err);
    return res.status(500).json({ message: 'Error al actualizar disponibilidad' });
  }
}

// ── CRUD Usuarios ────────────────────────────────────────────
export async function getAdminUsers(_req: Request, res: Response) {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, r.name AS role,
             u.phone, u.is_active, u.created_at,
             MAX(o.created_at) AS last_order
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN orders o ON o.waiter_id = u.id OR o.cashier_id = u.id
      GROUP BY u.id, r.name
      ORDER BY r.name, u.first_name
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('[admin/users/get]', err);
    return res.status(500).json({ message: 'Error al obtener usuarios' });
  }
}

export async function createAdminUser(req: Request, res: Response) {
  try {
    const { email, password, first_name, last_name, role_name, phone } = req.body;
    if (!email || !password || !first_name || !last_name || !role_name) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
    const roleR = await pool.query('SELECT id FROM roles WHERE name=$1', [role_name]);
    if (!roleR.rows[0]) return res.status(400).json({ message: `Rol '${role_name}' no existe` });

    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (exists.rows[0]) return res.status(409).json({ message: 'El email ya está registrado' });

    const hash   = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, phone)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, first_name, last_name, is_active, created_at, phone`,
      [email.toLowerCase(), hash, first_name, last_name, roleR.rows[0].id, phone ?? null]
    );
    return res.status(201).json({ ...result.rows[0], role: role_name, last_order: null });
  } catch (err) {
    console.error('[admin/users/create]', err);
    return res.status(500).json({ message: 'Error al crear usuario' });
  }
}

export async function updateAdminUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { first_name, last_name, role_name, phone, is_active } = req.body;

    const roleR = await pool.query('SELECT id FROM roles WHERE name=$1', [role_name]);
    if (!roleR.rows[0]) return res.status(400).json({ message: `Rol '${role_name}' no existe` });

    const result = await pool.query(
      `UPDATE users SET first_name=$1, last_name=$2, role_id=$3, phone=$4, is_active=$5, updated_at=NOW()
       WHERE id=$6 RETURNING id, email, first_name, last_name, is_active, created_at, phone`,
      [first_name, last_name, roleR.rows[0].id, phone ?? null, is_active ?? true, id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.json({ ...result.rows[0], role: role_name });
  } catch (err) {
    console.error('[admin/users/update]', err);
    return res.status(500).json({ message: 'Error al actualizar usuario' });
  }
}

export async function toggleUserActive(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const result = await pool.query(
      `UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2
       RETURNING id, email, first_name, last_name, is_active, phone, created_at`,
      [is_active, id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' });
    const roleR = await pool.query('SELECT r.name FROM users u JOIN roles r ON u.role_id=r.id WHERE u.id=$1', [id]);
    return res.json({ ...result.rows[0], role: roleR.rows[0]?.name });
  } catch (err) {
    console.error('[admin/users/toggle]', err);
    return res.status(500).json({ message: 'Error al cambiar estado' });
  }
}

export async function resetUserPassword(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    if (!new_password || String(new_password).length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const hash = await bcrypt.hash(String(new_password), 10);
    const result = await pool.query(
      'UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2 RETURNING id',
      [hash, id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' });

    await pool.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, user_id)
       VALUES ('password_reset', 'user', $1, $2)`,
      [id, req.user?.id]
    );
    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('[admin/users/reset-pwd]', err);
    return res.status(500).json({ message: 'Error al resetear contraseña' });
  }
}

// ── Configuración ────────────────────────────────────────────
// Guarda configuración en una tabla simple key-value (si existe)
// Si no existe la tabla, retorna defaults sin error.
export async function getSettings(_req: Request, res: Response) {
  try {
    // Intentar leer de tabla settings si existe
    const result = await pool.query(`
      SELECT key, value FROM settings
    `).catch(() => ({ rows: [] as Array<{ key: string; value: string }> }));

    const settings: Record<string, unknown> = {
      name: 'RestaurantPWA', address: '', phone: '',
      tax_rate: 8, tip_suggestion: 10, currency: 'USD', timezone: 'America/Bogota',
    };
    for (const row of result.rows) {
      settings[row.key] = isNaN(Number(row.value)) ? row.value : Number(row.value);
    }
    return res.json(settings);
  } catch {
    return res.json({ name:'RestaurantPWA', address:'', phone:'', tax_rate:8, tip_suggestion:10, currency:'USD', timezone:'America/Bogota' });
  }
}

export async function saveSettings(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Crear tabla si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key   VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const data = req.body as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      await client.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [key, String(value)]
      );
    }
    await client.query('COMMIT');
    return res.json(data);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[admin/settings/save]', err);
    return res.status(500).json({ message: 'Error al guardar configuración' });
  } finally {
    client.release();
  }
}