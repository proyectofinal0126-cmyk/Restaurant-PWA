// ============================================================
// frontend/src/types/table.ts  —  Fase 6: Módulo Mesero
//
// Tipos del módulo mesero. Archivo separado para no contaminar
// types/order.ts que es compartido con el flujo autoservicio.
//
// ARQUITECTURA: Autoservicio y Mesero son modalidades independientes.
// Este archivo solo existe en el contexto de la modalidad Mesero.
// ============================================================

/** Estados posibles de una mesa */
export type TableStatus =
  | 'available'    // Libre, sin orden activa
  | 'occupied'     // Con clientes y orden activa
  | 'reserved'     // Reservada (sin clientes aún)
  | 'waiting_bill' // Clientes esperando la cuenta

/** Mesa enriquecida con datos de la orden activa (JOIN en backend) */
export interface Table {
  id:              string;
  number:          number;       // Número visible de la mesa (1, 2, 3...)
  capacity:        number;       // Personas máximas
  section:         string | null;// 'Salón principal', 'Terraza', etc.
  status:          TableStatus;
  qr_code:         string | null;

  // Campos calculados dinámicamente por el backend (JOIN con orders)
  // NO están en el schema — se calculan en la query de getAllTables
  current_order_id?:     string | null;    // UUID de la orden activa
  current_order_number?: string | null;    // Ej: 'ORD-0007'
  current_order_status?: string | null;    // Status legible de la orden
  waiter_id?:            string | null;    // UUID del mesero asignado
  waiter_name?:          string | null;    // Nombre del mesero
  order_created_at?:     string | null;    // Para calcular tiempo en mesa
}

/** Payload para tomar orden desde la tablet del mesero */
export interface WaiterOrderPayload {
  table_id:       string;        // UUID de la mesa (requerido en modo mesero)
  source:         'waiter';      // Literal — siempre 'waiter'
  items: Array<{
    menu_item_id:         string;
    quantity:             number;
    special_instructions: string;
  }>;
  payment_method: 'efectivo' | 'tarjeta' | 'transferencia';
  notes:          string;
  waiter_id?:     string;        // UUID del mesero (se inyecta desde auth)
}

/** Payload para actualizar estado de mesa */
export interface UpdateTableStatusPayload {
  status: TableStatus;
}

/** Respuesta del endpoint de mesas enriquecidas */
export type TablesResponse = Table[];

/** Item del carrito del mesero (temporal, en memoria) */
export interface WaiterCartItem {
  menuItemId:  string;
  name:        string;
  price:       number;
  quantity:    number;
  notes:       string; // instrucciones especiales por item
}

/** Estado del carrito del mesero para una mesa específica */
export interface WaiterCart {
  tableId:     string;
  tableNumber: number;
  items:       WaiterCartItem[];
  paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia';
  orderNotes:  string;
}