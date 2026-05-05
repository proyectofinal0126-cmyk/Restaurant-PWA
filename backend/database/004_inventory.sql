-- ============================================================
-- backend/database/004_inventory.sql  —  Fase 9
--
-- Agrega al schema existente las tablas del módulo de bodega.
-- SEGURO para ejecutar sobre BD existente: usa IF NOT EXISTS
-- y ON CONFLICT DO NOTHING en los seeds.
--
-- Ejecutar dentro del contenedor:
--   docker exec -i restaurant_db psql -U postgres -d restaurant_pwa \
--     < backend/database/004_inventory.sql
-- ============================================================

-- ── Proveedores ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(150) NOT NULL UNIQUE,
  contact_name VARCHAR(100),
  phone        VARCHAR(30),
  email        VARCHAR(255),
  address      TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- ── Ingredientes (materia prima de bodega) ───────────────────
CREATE TABLE IF NOT EXISTS ingredients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(150) NOT NULL UNIQUE,
  unit           VARCHAR(30)  NOT NULL,          -- kg, l, und, g, ml, porciones…
  stock_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  min_stock      DECIMAL(12,3) NOT NULL DEFAULT 0,
  cost_per_unit  DECIMAL(10,2) NOT NULL DEFAULT 0,
  supplier_id    UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

-- ── Recetas: relación menu_item → ingrediente ────────────────
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id      UUID NOT NULL REFERENCES menu_items(id)  ON DELETE CASCADE,
  ingredient_id     UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_required DECIMAL(12,3) NOT NULL,      -- cantidad por porción
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE (menu_item_id, ingredient_id)
);

-- ── Retiros de turno (cocinero) ──────────────────────────────
CREATE TABLE IF NOT EXISTS shift_withdrawals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_user_id UUID NOT NULL REFERENCES users(id),
  started_at   TIMESTAMP DEFAULT NOW(),
  closed_at    TIMESTAMP,
  status       VARCHAR(20) DEFAULT 'abierto'
                 CHECK (status IN ('abierto','cerrado')),
  notes        TEXT
);

-- ── Detalle de cada retiro ───────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_withdrawal_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_withdrawal_id UUID NOT NULL REFERENCES shift_withdrawals(id) ON DELETE CASCADE,
  ingredient_id       UUID NOT NULL REFERENCES ingredients(id),
  quantity_withdrawn  DECIMAL(12,3) NOT NULL,
  quantity_remaining  DECIMAL(12,3),             -- stock sobrante al momento del retiro
  created_at          TIMESTAMP DEFAULT NOW(),
  UNIQUE (shift_withdrawal_id, ingredient_id)
);

-- ── Historial de movimientos de bodega ───────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id       UUID NOT NULL REFERENCES ingredients(id),
  type                VARCHAR(30) NOT NULL
                        CHECK (type IN ('entrada','salida','ajuste','consumo_turno')),
  quantity            DECIMAL(12,3) NOT NULL,    -- positivo=entrada, negativo=salida/ajuste
  stock_after         DECIMAL(12,3),             -- stock resultante (snapshot)
  user_id             UUID REFERENCES users(id),
  shift_withdrawal_id UUID REFERENCES shift_withdrawals(id),
  notes               TEXT,
  created_at          TIMESTAMP DEFAULT NOW()
);

-- ── Índices para rendimiento ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ingredients_supplier    ON ingredients(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_active      ON ingredients(is_active);
CREATE INDEX IF NOT EXISTS idx_inv_mov_ingredient      ON inventory_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type            ON inventory_movements(type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_created         ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_inv_mov_withdrawal      ON inventory_movements(shift_withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_shift_wd_cook           ON shift_withdrawals(cook_user_id);
CREATE INDEX IF NOT EXISTS idx_shift_wd_status         ON shift_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingr_item     ON menu_item_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingr_ingr     ON menu_item_ingredients(ingredient_id);

-- ── Seeds de prueba ──────────────────────────────────────────
-- Proveedores
INSERT INTO suppliers (name, contact_name, phone, email, address) VALUES
  ('Distribuidora Alimentos Frescos', 'Juliana Mora',   '310-000-0001', 'juliana@frescos.co',   'Cra 30 # 45-12, Bogotá'),
  ('Carnes Premium S.A.S',            'Ricardo Pardo',  '311-000-0002', 'rpardo@carnesprem.co', 'Av. Boyacá # 12-80, Bogotá'),
  ('Bebidas del Valle',               'Sofía Herrera',  '315-000-0003', 'sofia@bebidasv.co',    'Calle 80 # 90-34, Medellín')
ON CONFLICT (name) DO NOTHING;

-- Ingredientes base alineados con el menú existente
INSERT INTO ingredients (name, unit, stock_quantity, min_stock, cost_per_unit, supplier_id)
SELECT 'Lechuga romana',   'kg',  8.000,  2.000, 3500, id FROM suppliers WHERE name = 'Distribuidora Alimentos Frescos' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO ingredients (name, unit, stock_quantity, min_stock, cost_per_unit, supplier_id)
SELECT 'Parmesano rallado','kg',  4.000,  1.000, 28000, id FROM suppliers WHERE name = 'Distribuidora Alimentos Frescos' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO ingredients (name, unit, stock_quantity, min_stock, cost_per_unit, supplier_id)
SELECT 'Carne molida 80/20','kg', 12.000, 3.000, 18000, id FROM suppliers WHERE name = 'Carnes Premium S.A.S' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO ingredients (name, unit, stock_quantity, min_stock, cost_per_unit, supplier_id)
SELECT 'Pan de hamburguesa','und', 24, 8, 1200, id FROM suppliers WHERE name = 'Distribuidora Alimentos Frescos' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO ingredients (name, unit, stock_quantity, min_stock, cost_per_unit, supplier_id)
SELECT 'Queso cheddar',    'kg',   3.000,  1.000, 22000, id FROM suppliers WHERE name = 'Distribuidora Alimentos Frescos' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO ingredients (name, unit, stock_quantity, min_stock, cost_per_unit, supplier_id)
SELECT 'Fettuccine seco',  'kg',   6.000,  1.500, 4500, id FROM suppliers WHERE name = 'Distribuidora Alimentos Frescos' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO ingredients (name, unit, stock_quantity, min_stock, cost_per_unit, supplier_id)
SELECT 'Crema de leche',   'l',    4.000,  1.000, 6500, id FROM suppliers WHERE name = 'Distribuidora Alimentos Frescos' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO ingredients (name, unit, stock_quantity, min_stock, cost_per_unit, supplier_id)
SELECT 'Limón tahití',     'kg',   5.000,  1.500, 3200, id FROM suppliers WHERE name = 'Distribuidora Alimentos Frescos' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO ingredients (name, unit, stock_quantity, min_stock, cost_per_unit, supplier_id)
SELECT 'Chocolate 70%',    'kg',   2.000,  0.500, 32000, id FROM suppliers WHERE name = 'Distribuidora Alimentos Frescos' LIMIT 1
ON CONFLICT (name) DO NOTHING;

-- Ingrediente con stock bajo para demostrar alertas
INSERT INTO ingredients (name, unit, stock_quantity, min_stock, cost_per_unit, supplier_id)
SELECT 'Helado de vainilla','kg',  0.800,  1.000, 15000, id FROM suppliers WHERE name = 'Distribuidora Alimentos Frescos' LIMIT 1
ON CONFLICT (name) DO NOTHING;

-- Ingrediente agotado para demostrar estado crítico
INSERT INTO ingredients (name, unit, stock_quantity, min_stock, cost_per_unit, supplier_id)
SELECT 'Agua mineral 500ml','und', 0,      12,    800, id FROM suppliers WHERE name = 'Bebidas del Valle' LIMIT 1
ON CONFLICT (name) DO NOTHING;