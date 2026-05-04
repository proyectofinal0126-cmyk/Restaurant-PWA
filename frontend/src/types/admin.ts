// ============================================================
// frontend/src/types/admin.ts  —  Fase 8 + Modo de operación
// ============================================================

// ── KPIs del dashboard ───────────────────────────────────────
export interface AdminStats {
  today: {
    orders:        number;
    revenue:       number;
    avgTicket:     number;
    cancelledOrders: number;
  };
  topTable: {
    number:  number | null;
    section: string | null;
    orders:  number;
  };
  topItem: {
    name:     string | null;
    category: string | null;
    qty:      number;
  };
  topWaiter: {
    name:   string | null;
    orders: number;
  };
  byHour:     HourlyStat[];
  byCategory: CategoryStat[];
  bySource:   SourceStat[];
}

export interface HourlyStat {
  hour:    number;
  orders:  number;
  revenue: number;
}

export interface CategoryStat {
  category: string;
  qty:      number;
  revenue:  number;
}

export interface SourceStat {
  source:  string;
  orders:  number;
  revenue: number;
}

// ── Reporte filtrable ────────────────────────────────────────
export interface ReportFilter {
  from:   string;
  to:     string;
  source?: 'autoservicio' | 'waiter' | 'all';
}

export interface ReportData {
  from:    string;
  to:      string;
  summary: {
    totalOrders:    number;
    totalRevenue:   number;
    totalTips:      number;
    avgTicket:      number;
    completionRate: number;
  };
  byDay:        DailyStat[];
  topItems:     TopItem[];
  topWaiters:   WaiterStat[];
  peakHours:    HourlyStat[];
  avgTimings: {
    toKitchen:   number | null;
    preparation: number | null;
    total:       number | null;
  };
}

export interface DailyStat {
  date:    string;
  orders:  number;
  revenue: number;
  tips:    number;
}

export interface TopItem {
  name:     string;
  category: string;
  qty:      number;
  revenue:  number;
}

export interface WaiterStat {
  name:    string;
  orders:  number;
  revenue: number;
  avgTime: number | null;
}

// ── Gestión de menú ─────────────────────────────────────────
export interface AdminCategory {
  id:          string;
  name:        string;
  description: string | null;
  icon:        string | null;
  image_url:   string | null;
  position:    number;
  is_active:   boolean;
  items_count: number;
  created_at:  string;
}

export interface AdminMenuItem {
  id:               string;
  category_id:      string;
  category_name:    string;
  name:             string;
  description:      string | null;
  image_url:        string | null;
  price:            number;
  preparation_time: number | null;
  is_available:     boolean;
  is_out_of_stock:  boolean;
  orders_count:     number;
  created_at:       string;
  updated_at:       string;
}

export interface CategoryForm {
  name:        string;
  description: string;
  icon:        string;
  position:    number;
  is_active:   boolean;
}

export interface MenuItemForm {
  category_id:      string;
  name:             string;
  description:      string;
  price:            number;
  preparation_time: number;
  is_available:     boolean;
  is_out_of_stock:  boolean;
}

// ── Gestión de usuarios ──────────────────────────────────────
export interface AdminUser {
  id:         string;
  email:      string;
  first_name: string;
  last_name:  string;
  role:       string;
  phone:      string | null;
  is_active:  boolean;
  created_at: string;
  last_order: string | null;
}

export interface UserForm {
  email:      string;
  first_name: string;
  last_name:  string;
  role_name:  string;
  phone:      string;
  password?:  string;
  is_active:  boolean;
}

// ── Configuración del restaurante ────────────────────────────
// Nota: operation_mode NO está aquí porque lo fija el equipo
// técnico en el .env al desplegar, no el admin del restaurante.
export interface RestaurantSettings {
  name:           string;
  address:        string;
  phone:          string;
  tax_rate:       number;
  tip_suggestion: number;
  currency:       string;
  timezone:       string;
}