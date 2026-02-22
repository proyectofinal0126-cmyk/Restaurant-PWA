-- ============ ROLES/USUARIOS ============
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============ MESAS ============
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  capacity INTEGER NOT NULL,
  section VARCHAR(50),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved')),
  qr_code TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============ CATEGORÍAS DE MENÚ ============
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(255),
  image_url TEXT,
  position INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============ ITEMS DEL MENÚ ============
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES menu_categories(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  image_url TEXT,
  price DECIMAL(10, 2) NOT NULL,
  preparation_time INTEGER,
  is_available BOOLEAN DEFAULT TRUE,
  is_out_of_stock BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============ ÓRDENES ============
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(10) UNIQUE NOT NULL,
  table_id UUID REFERENCES tables(id),
  customer_id UUID REFERENCES users(id),
  waiter_id UUID REFERENCES users(id),
  cashier_id UUID REFERENCES users(id),
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2),
  discount DECIMAL(10, 2),
  tip DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  payment_method VARCHAR(20),
  payment_status VARCHAR(20) DEFAULT 'pending',
  payment_reference VARCHAR(255),
  source VARCHAR(20) CHECK (source IN ('app', 'waiter', 'kiosk')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  validated_at TIMESTAMP,
  sent_to_kitchen_at TIMESTAMP,
  ready_at TIMESTAMP,
  delivered_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- ============ ITEMS DE ORDEN ============
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  special_instructions TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============ PAGOS ============
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  amount DECIMAL(10, 2) NOT NULL,
  method VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  reference VARCHAR(255),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============ AUDIT LOG ============
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  timestamp TIMESTAMP DEFAULT NOW()
);

-- ============ ÍNDICES ============
CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_waiter ON orders(waiter_id);
CREATE INDEX idx_orders_cashier ON orders(cashier_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);