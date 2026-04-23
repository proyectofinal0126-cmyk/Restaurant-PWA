-- ============================================================
-- migration_timings.sql  —  Fix 5: Métricas de tiempo entre módulos
--
-- Registra automáticamente los tiempos entre cada transición
-- de estado de una orden para análisis descriptivo del negocio.
--
-- Aplicar:
--   docker exec -i restaurant_postgres psql \
--     -U postgres -d restaurant_pwa < migration_timings.sql
-- ============================================================

-- Tabla de métricas operacionales por orden
CREATE TABLE IF NOT EXISTS order_timings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number    VARCHAR(10) NOT NULL,
  source          VARCHAR(20),  -- 'autoservicio' | 'waiter'

  -- Tiempos de cada transición (en segundos)
  -- NULL si el paso no aplica o no ocurrió aún

  -- Cliente/mesero crea la orden
  created_at      TIMESTAMP,

  -- Caja confirma el pago y envía a cocina (solo autoservicio)
  -- En mesero este paso no existe — va directo a cocina
  time_to_validate_secs   INTEGER,  -- created_at → validated_at
  validated_at            TIMESTAMP,

  -- Caja envía a cocina
  time_to_kitchen_secs    INTEGER,  -- validated_at (o created_at) → sent_to_kitchen_at
  sent_to_kitchen_at      TIMESTAMP,

  -- Cocina prepara
  time_to_ready_secs      INTEGER,  -- sent_to_kitchen_at → ready_at
  ready_at                TIMESTAMP,

  -- Mesero entrega / Cliente retira
  time_to_deliver_secs    INTEGER,  -- ready_at → delivered_at
  delivered_at            TIMESTAMP,

  -- Orden completada
  time_total_secs         INTEGER,  -- created_at → completed_at
  completed_at            TIMESTAMP,

  -- Metadatos
  table_number    INTEGER,
  waiter_name     TEXT,
  cashier_name    TEXT,
  items_count     INTEGER,
  total_amount    DECIMAL(10,2),

  recorded_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timings_order   ON order_timings(order_id);
CREATE INDEX IF NOT EXISTS idx_timings_date    ON order_timings(DATE(created_at));
CREATE INDEX IF NOT EXISTS idx_timings_source  ON order_timings(source);

-- Función para calcular y registrar los timings al completar una orden
CREATE OR REPLACE FUNCTION record_order_timings()
RETURNS TRIGGER AS $$
DECLARE
  v_order      RECORD;
  v_table_num  INTEGER;
  v_waiter     TEXT;
  v_cashier    TEXT;
  v_items      INTEGER;
BEGIN
  -- Solo actuar cuando el status cambia a 'completed'
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Obtener datos adicionales
  SELECT t.number INTO v_table_num
  FROM tables t WHERE t.id = NEW.table_id;

  SELECT u.first_name || ' ' || u.last_name INTO v_waiter
  FROM users u WHERE u.id = NEW.waiter_id;

  SELECT u.first_name || ' ' || u.last_name INTO v_cashier
  FROM users u WHERE u.id = NEW.cashier_id;

  SELECT COUNT(*) INTO v_items
  FROM order_items WHERE order_id = NEW.id;

  -- Insertar el registro de timings
  INSERT INTO order_timings (
    order_id, order_number, source,
    created_at,
    time_to_validate_secs, validated_at,
    time_to_kitchen_secs,  sent_to_kitchen_at,
    time_to_ready_secs,    ready_at,
    time_to_deliver_secs,  delivered_at,
    time_total_secs,       completed_at,
    table_number, waiter_name, cashier_name,
    items_count, total_amount
  ) VALUES (
    NEW.id, NEW.order_number, NEW.source,
    NEW.created_at,

    -- Tiempo hasta validación (autoservicio: caja confirma pago)
    CASE WHEN NEW.validated_at IS NOT NULL
         THEN EXTRACT(EPOCH FROM (NEW.validated_at - NEW.created_at))::INTEGER
         ELSE NULL END,
    NEW.validated_at,

    -- Tiempo hasta cocina (desde validación o desde creación si no hubo validación)
    CASE WHEN NEW.sent_to_kitchen_at IS NOT NULL
         THEN EXTRACT(EPOCH FROM (
           NEW.sent_to_kitchen_at -
           COALESCE(NEW.validated_at, NEW.created_at)
         ))::INTEGER
         ELSE NULL END,
    NEW.sent_to_kitchen_at,

    -- Tiempo de preparación
    CASE WHEN NEW.ready_at IS NOT NULL AND NEW.sent_to_kitchen_at IS NOT NULL
         THEN EXTRACT(EPOCH FROM (NEW.ready_at - NEW.sent_to_kitchen_at))::INTEGER
         ELSE NULL END,
    NEW.ready_at,

    -- Tiempo hasta entrega
    CASE WHEN NEW.delivered_at IS NOT NULL AND NEW.ready_at IS NOT NULL
         THEN EXTRACT(EPOCH FROM (NEW.delivered_at - NEW.ready_at))::INTEGER
         ELSE NULL END,
    NEW.delivered_at,

    -- Tiempo total del ciclo
    CASE WHEN NEW.completed_at IS NOT NULL
         THEN EXTRACT(EPOCH FROM (NEW.completed_at - NEW.created_at))::INTEGER
         ELSE NULL END,
    NEW.completed_at,

    v_table_num, v_waiter, v_cashier,
    v_items, NEW.total
  )
  ON CONFLICT (order_id) DO UPDATE SET
    time_to_validate_secs  = EXCLUDED.time_to_validate_secs,
    validated_at           = EXCLUDED.validated_at,
    time_to_kitchen_secs   = EXCLUDED.time_to_kitchen_secs,
    sent_to_kitchen_at     = EXCLUDED.sent_to_kitchen_at,
    time_to_ready_secs     = EXCLUDED.time_to_ready_secs,
    ready_at               = EXCLUDED.ready_at,
    time_to_deliver_secs   = EXCLUDED.time_to_deliver_secs,
    delivered_at           = EXCLUDED.delivered_at,
    time_total_secs        = EXCLUDED.time_total_secs,
    completed_at           = EXCLUDED.completed_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que se ejecuta automáticamente al actualizar una orden
DROP TRIGGER IF EXISTS trg_record_order_timings ON orders;
CREATE TRIGGER trg_record_order_timings
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION record_order_timings();

-- Vista para análisis descriptivo fácil
CREATE OR REPLACE VIEW v_order_metrics AS
SELECT
  DATE(created_at)                        AS fecha,
  source                                  AS modalidad,
  COUNT(*)                                AS total_ordenes,
  ROUND(AVG(time_to_validate_secs) / 60.0, 1) AS avg_min_hasta_validacion,
  ROUND(AVG(time_to_kitchen_secs)  / 60.0, 1) AS avg_min_hasta_cocina,
  ROUND(AVG(time_to_ready_secs)    / 60.0, 1) AS avg_min_preparacion,
  ROUND(AVG(time_to_deliver_secs)  / 60.0, 1) AS avg_min_hasta_entrega,
  ROUND(AVG(time_total_secs)       / 60.0, 1) AS avg_min_ciclo_total,
  ROUND(MIN(time_total_secs)       / 60.0, 1) AS min_ciclo_total,
  ROUND(MAX(time_total_secs)       / 60.0, 1) AS max_ciclo_total,
  SUM(total_amount)                       AS ingresos_totales
FROM order_timings
WHERE completed_at IS NOT NULL
GROUP BY DATE(created_at), source
ORDER BY fecha DESC, source;

-- Verificación
SELECT 'Migración completada' AS mensaje;
SELECT COUNT(*) AS registros_timings FROM order_timings;