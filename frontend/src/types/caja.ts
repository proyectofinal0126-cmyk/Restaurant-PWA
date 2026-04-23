 // ============================================================
// frontend/src/types/caja.ts  —  Fase 4: Caja Autoservicio
// ============================================================

import type { Order, OrderStatus } from './order';

export type CajaColumn = 'pendientes' | 'en_cocina' | 'listos';

// Qué estados van en cada columna del Kanban
export const COLUMN_STATUSES: Record<CajaColumn, OrderStatus[]> = {
  pendientes: ['pending_payment', 'payment_confirmed', 'pending_validation'],
  en_cocina:  ['sent_to_kitchen', 'in_preparation'],
  listos:     ['ready_for_pickup'],
};

// Orden enriquecida con metadatos calculados en cliente
export interface OrderWithMeta extends Order {
  elapsedMinutes: number;   // minutos desde created_at
  isUrgent:       boolean;  // verdadero si > 20 min
}

export interface CloseOrderPayload {
  cashier_notes?: string;
}

export interface CloseOrderResponse {
  order:   Order;
  receipt: ReceiptData;
}

export interface ReceiptData {
  order_number:   string;
  items:          Array<{ name: string; quantity: number; price: number; subtotal: number }>;
  subtotal:       number;
  tax:            number;
  total:          number;
  payment_method: string;
  created_at:     string;
  completed_at:   string;
}