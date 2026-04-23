// ============================================================
// backend/src/controllers/metricsController.ts  —  Fix 5
//
// GET /api/orders/metrics
// Retorna métricas de tiempo entre módulos para análisis
// descriptivo de las operaciones del restaurante.
// Solo accesible por caja y admin.
// ============================================================

import { Response } from 'express';
import pool         from '../utils/db';
import type { AuthRequest } from '../middleware/auth';

export async function getOrderMetrics(req: AuthRequest, res: Response) {
  try {
    const { date, days = '7' } = req.query;
    const targetDate = date ? String(date) : new Date().toISOString().split('T')[0];
    const numDays    = Math.min(parseInt(String(days)) || 7, 90); // máx 90 días

    // Resumen por día y modalidad
    const dailyResult = await pool.query(`
      SELECT
        DATE(o.created_at AT TIME ZONE 'America/Bogota')  AS fecha,
        o.source                                           AS modalidad,
        COUNT(*)                                           AS total_ordenes,
        COUNT(*) FILTER (WHERE o.status = 'completed')    AS completadas,
        COUNT(*) FILTER (WHERE o.status = 'cancelled')    AS canceladas,
        ROUND(AVG(
          CASE WHEN o.validated_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (o.validated_at - o.created_at)) / 60
               ELSE NULL END
        )::NUMERIC, 1)                                     AS avg_min_validacion,
        ROUND(AVG(
          CASE WHEN o.sent_to_kitchen_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (
                 o.sent_to_kitchen_at -
                 COALESCE(o.validated_at, o.created_at)
               )) / 60
               ELSE NULL END
        )::NUMERIC, 1)                                     AS avg_min_a_cocina,
        ROUND(AVG(
          CASE WHEN o.ready_at IS NOT NULL AND o.sent_to_kitchen_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (o.ready_at - o.sent_to_kitchen_at)) / 60
               ELSE NULL END
        )::NUMERIC, 1)                                     AS avg_min_preparacion,
        ROUND(AVG(
          CASE WHEN o.completed_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (o.completed_at - o.created_at)) / 60
               ELSE NULL END
        )::NUMERIC, 1)                                     AS avg_min_ciclo_total,
        COALESCE(SUM(o.total) FILTER (WHERE o.status = 'completed'), 0) AS ingresos
      FROM orders o
      WHERE DATE(o.created_at AT TIME ZONE 'America/Bogota')
            BETWEEN ($1::date - ($2 || ' days')::interval)::date AND $1::date
      GROUP BY DATE(o.created_at AT TIME ZONE 'America/Bogota'), o.source
      ORDER BY fecha DESC, modalidad
    `, [targetDate, numDays - 1]);

    // Hoy en detalle — última hora por hora
    const todayResult = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM o.created_at AT TIME ZONE 'America/Bogota') AS hora,
        COUNT(*)                                              AS ordenes,
        COALESCE(SUM(o.total) FILTER (WHERE o.status = 'completed'), 0) AS ingresos,
        ROUND(AVG(
          CASE WHEN o.completed_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (o.completed_at - o.created_at)) / 60
               ELSE NULL END
        )::NUMERIC, 1)                                        AS avg_min_ciclo
      FROM orders o
      WHERE DATE(o.created_at AT TIME ZONE 'America/Bogota') = $1
      GROUP BY EXTRACT(HOUR FROM o.created_at AT TIME ZONE 'America/Bogota')
      ORDER BY hora
    `, [targetDate]);

    // Órdenes más lentas del día (para identificar cuellos de botella)
    const slowResult = await pool.query(`
      SELECT
        o.order_number,
        o.source,
        t.number AS table_number,
        ROUND(EXTRACT(EPOCH FROM (
          o.completed_at - o.created_at
        )) / 60)::INTEGER                          AS total_min,
        ROUND(EXTRACT(EPOCH FROM (
          COALESCE(o.validated_at, o.sent_to_kitchen_at) - o.created_at
        )) / 60)::INTEGER                          AS min_espera_caja,
        ROUND(EXTRACT(EPOCH FROM (
          o.ready_at - o.sent_to_kitchen_at
        )) / 60)::INTEGER                          AS min_cocina
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE DATE(o.created_at AT TIME ZONE 'America/Bogota') = $1
        AND o.status = 'completed'
        AND o.completed_at IS NOT NULL
      ORDER BY (o.completed_at - o.created_at) DESC
      LIMIT 5
    `, [targetDate]);

    return res.json({
      date:      targetDate,
      days:      numDays,
      daily:     dailyResult.rows,
      byHour:    todayResult.rows,
      slowest:   slowResult.rows,
    });
  } catch (err) {
    console.error('[metrics/getOrderMetrics]', err);
    return res.status(500).json({ message: 'Error al obtener métricas' });
  }
}