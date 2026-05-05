-- ============================================================
-- backend/database/seeds.sql
-- FIX #3: Roles en español (admin, caja, cocina, mesero)
-- FIX #4: Usuarios con hashes bcrypt reales incluidos
-- FIX #7: ON CONFLICT funciona porque schema.sql ahora tiene
--         UNIQUE en menu_categories.name y menu_items.name
-- ============================================================

-- ── Secuencia atómica para order_number ──────────────────────
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- ── Roles ────────────────────────────────────────────────────
INSERT INTO roles (name, description) VALUES
  ('admin',   'Administrador con acceso total'),
  ('caja',    'Cajero: valida y cierra pedidos'),
  ('cocina',  'Cocinero: KDS y preparación'),
  ('mesero',  'Mesero: mesas y órdenes'),
  ('cliente', 'Cliente del restaurante')
ON CONFLICT (name) DO NOTHING;

-- ── Usuarios de prueba ───────────────────────────────────────
-- Contraseñas:
--   admin@restaurant.com   → admin1234
--   caja@restaurant.com    → caja1234
--   cocina@restaurant.com  → cocina1234
--   mesero@restaurant.com  → mesero1234
INSERT INTO users (email, password_hash, role_id, first_name, last_name, is_active)
VALUES
  (
    'admin@restaurant.com',
    '$2b$10$Nr/BBgIVtM878NzU1Hhkduazo3P1xo..Uho0ruJQJiwQtyZufBHmO',
    (SELECT id FROM roles WHERE name = 'admin'),
    'Admin', 'Sistema', true
  ),
  (
    'caja@restaurant.com',
    '$2b$10$9J9yAse2E6bM.c3arwNFcOtnbsqCq9YIi5x3EuUwN8Og8gp/qIWg6',
    (SELECT id FROM roles WHERE name = 'caja'),
    'Cajero', 'Sistema', true
  ),
  (
    'cocina@restaurant.com',
    '$2b$10$veo5Y1q8HiyQ3wA29SULDelmXAAluBdSSYC97mEw4Kf0rpT6.53Ve',
    (SELECT id FROM roles WHERE name = 'cocina'),
    'Cocina', 'Sistema', true
  ),
  (
    'mesero@restaurant.com',
    '$2b$10$duSAhC/4eaTzngZHL3PkluWvW4q0tzY5TxtpEsPklWlGi7M42Zytm',
    (SELECT id FROM roles WHERE name = 'mesero'),
    'Mesero', 'Sistema', true
  )
ON CONFLICT (email) DO NOTHING;

-- ── Mesas ────────────────────────────────────────────────────
INSERT INTO tables (number, capacity, section, status) VALUES
  (1, 4, 'Salón principal', 'available'),
  (2, 4, 'Salón principal', 'available'),
  (3, 6, 'Salón principal', 'available'),
  (4, 2, 'Terraza',         'available'),
  (5, 4, 'Terraza',         'available'),
  (6, 8, 'Privado',         'available')
ON CONFLICT (number) DO NOTHING;

-- ── Categorías de menú ───────────────────────────────────────
INSERT INTO menu_categories (name, description, position, is_active) VALUES
  ('Entradas',    'Para abrir el apetito',   1, true),
  ('Principales', 'Platos fuertes del chef', 2, true),
  ('Bebidas',     'Frescas y naturales',     3, true),
  ('Postres',     'El toque dulce final',    4, true)
ON CONFLICT (name) DO NOTHING;

-- ── Items de menú ────────────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, preparation_time, is_available)
SELECT id, 'Ensalada César', 'Lechuga romana, crutones, parmesano y aderezo Caesar', 8.50, 5, true
FROM menu_categories WHERE name = 'Entradas' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO menu_items (category_id, name, description, price, preparation_time, is_available)
SELECT id, 'Sopa del día', 'Consultar con el mesero', 6.00, 5, true
FROM menu_categories WHERE name = 'Entradas' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO menu_items (category_id, name, description, price, preparation_time, is_available)
SELECT id, 'Hamburguesa Clásica', 'Carne 200g, queso cheddar, lechuga y tomate', 12.00, 12, true
FROM menu_categories WHERE name = 'Principales' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO menu_items (category_id, name, description, price, preparation_time, is_available)
SELECT id, 'Pasta Alfredo', 'Fettuccine con salsa cremosa y parmesano', 11.50, 10, true
FROM menu_categories WHERE name = 'Principales' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO menu_items (category_id, name, description, price, preparation_time, is_available)
SELECT id, 'Limonada Natural', 'Limones frescos, agua y azúcar', 3.50, 3, true
FROM menu_categories WHERE name = 'Bebidas' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO menu_items (category_id, name, description, price, preparation_time, is_available)
SELECT id, 'Agua Mineral', '500ml', 2.00, 1, true
FROM menu_categories WHERE name = 'Bebidas' LIMIT 1
ON CONFLICT (name) DO NOTHING;

INSERT INTO menu_items (category_id, name, description, price, preparation_time, is_available)
SELECT id, 'Brownie con Helado', 'Brownie de chocolate tibio con helado de vainilla', 5.50, 5, true
FROM menu_categories WHERE name = 'Postres' LIMIT 1
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Credenciales:
--   admin@restaurant.com   / admin1234
--   caja@restaurant.com    / caja1234
--   cocina@restaurant.com  / cocina1234
--   mesero@restaurant.com  / mesero1234
-- ============================================================
