-- Insertar roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrador del sistema'),
  ('cashier', 'Cajero - gestión de pagos'),
  ('waiter', 'Mesero - toma de órdenes'),
  ('kitchen', 'Cocinero - preparación de platillos'),
  ('customer', 'Cliente - realiza pedidos');

-- Insertar tablas
INSERT INTO tables (number, capacity, section, qr_code) VALUES
  (1, 2, 'main', 'QR-001'),
  (2, 4, 'main', 'QR-002'),
  (3, 6, 'patio', 'QR-003'),
  (4, 2, 'bar', 'QR-004');

-- Insertar categorías
INSERT INTO menu_categories (name, description, position) VALUES
  ('Bebidas', 'Bebidas diversas', 1),
  ('Entradas', 'Aperitivos y entrada', 2),
  ('Platos Principales', 'Platos fuertes', 3),
  ('Postres', 'Postres y dulces', 4);