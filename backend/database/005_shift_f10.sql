-- ============================================================
-- backend/database/005_shift_f10.sql  —  Fase 10
--
-- Ejecutar una sola vez sobre la BD existente:
--   docker exec -i restaurant_db psql -U postgres -d restaurant_pwa \
--     < backend/database/005_shift_f10.sql
--
-- CAMBIOS:
--   1. inventory_movements: agrega columna order_item_id para
--      trazabilidad de consumo por ítem de orden
--   2. menu_categories: agrega columna skip_kitchen para
--      categorías que no necesitan preparación (ej: bebidas gaseosas)
--   3. Índices nuevos para rendimiento
-- ============================================================

-- ── 1. Trazabilidad de consumo en inventory_movements ───────
-- Permite saber qué orden/ítem generó cada movimiento de tipo consumo_turno
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inv_mov_order_item ON inventory_movements(order_item_id);

-- ── 2. Categorías que bypass la cocina ───────────────────────
-- Si skip_kitchen = true, los pedidos de esa categoría pasan
-- directamente de "sent_to_kitchen" a "ready_for_pickup" sin
-- mostrar la orden en el KDS.
ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS skip_kitchen BOOLEAN DEFAULT FALSE;

-- Actualizar la categoría Bebidas como ejemplo (la caté debe confirmar)
-- El admin puede activar esto desde el panel de gestión de menú.
-- No lo hacemos automáticamente para no asumir qué categorías aplican.

-- ── 3. Índice adicional para turno activo del cocinero ───────
-- Acelera la consulta "¿cuál es el turno abierto de este cocinero?"
CREATE INDEX IF NOT EXISTS idx_sw_cook_status
  ON shift_withdrawals(cook_user_id, status);

-- ── 4. Índice en shift_withdrawal_items.quantity_remaining ───
-- Acelera las consultas de mini-inventario y alertas de stock bajo
CREATE INDEX IF NOT EXISTS idx_swi_remaining
  ON shift_withdrawal_items(shift_withdrawal_id, quantity_remaining);

-- Verificación rápida
DO $$
BEGIN
  RAISE NOTICE 'Migración 005_shift_f10.sql aplicada correctamente';
END $$;