// ============================================================
// backend/src/controllers/menuController.ts  —  Fase 10
//
// CAMBIO F10:
//   - getCategories ahora incluye el campo skip_kitchen
//   - getMenuItemsWithSkip: helper para que el KDS sepa si un ítem
//     pertenece a una categoría que bypass la cocina
//
// CAMBIO F9 previo (DISTINCT ON):
//   - getCategories usa SELECT DISTINCT ON (id) para evitar duplicados
// ============================================================

import { Request, Response } from 'express';
import pool from '../utils/db';

interface MenuCategoryRow {
  id:           string;
  name:         string;
  description:  string | null;
  icon:         string | null;
  image_url:    string | null;
  position:     number;
  is_active:    boolean;
  skip_kitchen: boolean;  // ← NUEVO F10
}

interface MenuItemRow {
  id:               string;
  category_id:      string;
  name:             string;
  description:      string | null;
  image_url:        string | null;
  price:            string;
  preparation_time: number | null;
  is_available:     boolean;
  is_out_of_stock:  boolean;
  skip_kitchen:     boolean;  // ← heredado de la categoría
}

// GET /api/menu/categories — incluye skip_kitchen
export async function getCategories(_req: Request, res: Response) {
  try {
    const result = await pool.query<MenuCategoryRow>(`
      SELECT DISTINCT ON (id)
             id, name, description, icon, image_url, position, is_active,
             COALESCE(skip_kitchen, false) AS skip_kitchen
      FROM menu_categories
      WHERE is_active = true
      ORDER BY id, position ASC
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('[menu/categories]', err);
    return res.status(500).json({ message: 'Error al obtener categorías' });
  }
}

// GET /api/menu/items — incluye skip_kitchen de la categoría
export async function getMenuItems(req: Request, res: Response) {
  try {
    const { category } = req.query;

    let query = `
      SELECT
        mi.id, mi.category_id, mi.name, mi.description, mi.image_url,
        mi.price, mi.preparation_time, mi.is_available, mi.is_out_of_stock,
        COALESCE(mc.skip_kitchen, false) AS skip_kitchen
      FROM menu_items mi
      JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.is_available = true
    `;
    const params: string[] = [];

    if (category && typeof category === 'string') {
      params.push(category);
      query += ` AND mi.category_id = $${params.length}`;
    }

    query += ' ORDER BY mi.name ASC';

    const result = await pool.query<MenuItemRow>(query, params);
    return res.json(result.rows.map((item) => ({
      ...item,
      price:        parseFloat(item.price),
      skip_kitchen: item.skip_kitchen ?? false,
    })));
  } catch (err) {
    console.error('[menu/items]', err);
    return res.status(500).json({ message: 'Error al obtener items del menú' });
  }
}