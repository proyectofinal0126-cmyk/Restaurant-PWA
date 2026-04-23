// ============================================================
// frontend/src/services/waiterService.ts  —  Fase 6
//
// Servicios HTTP para el módulo mesero.
// Todas las rutas requieren JWT con rol mesero/admin.
//
// SEPARACIÓN: Este servicio es independiente de orderService.ts
// (que es para autoservicio). El endpoint POST /orders es el mismo
// pero el payload es WaiterOrderPayload (con table_id y source:'waiter').
// ============================================================

import { apiFetch } from './api';
import type { Table, WaiterOrderPayload } from '../types/table';
import type { Order } from '../types/order';

/**
 * Obtiene todas las mesas enriquecidas con datos de orden activa.
 * El backend hace JOIN con orders para calcular current_order_id,
 * waiter_name, etc. sin modificar el schema de tables.
 */
export const getTables = (): Promise<Table[]> =>
  apiFetch<Table[]>('/tables');

/**
 * Actualiza el estado de una mesa.
 * Usado por el mesero para marcar mesa como disponible, etc.
 */
export const updateTableStatus = (
  tableId: string,
  status: Table['status']
): Promise<Table> =>
  apiFetch<Table>(`/tables/${tableId}/status`, {
    method: 'PATCH',
    body:   JSON.stringify({ status }),
  });

/**
 * Crea una orden desde la tablet del mesero.
 * DIFERENCIA con autoservicio:
 *   - table_id: string (requerido, no null)
 *   - source: 'waiter' (literal fijo)
 *
 * El endpoint /api/orders ya acepta source='waiter' con table_id.
 * Ver orderController.ts línea: if (source === 'waiter' && !table_id)
 */
export const createWaiterOrder = (payload: WaiterOrderPayload): Promise<Order> =>
  apiFetch<Order>('/orders', {
    method: 'POST',
    body:   JSON.stringify(payload),
  });

/**
 * Obtiene órdenes activas filtradas — para que el mesero
 * vea el estado de sus mesas en tiempo real.
 */
export const getActiveOrders = (): Promise<Order[]> =>
  apiFetch<Order[]>('/orders/active');

/**
 * Obtiene el detalle de una orden específica (con items).
 */
export const getOrderDetail = (orderId: string): Promise<Order> =>
  apiFetch<Order>(`/orders/${orderId}`);

/**
 * Marca una orden como entregada (mesero entregó el pedido a la mesa).
 * PATCH /api/orders/:id/status con status: 'delivered'
 */
export const markAsDelivered = (orderId: string): Promise<Order> =>
  apiFetch<Order>(`/orders/${orderId}/status`, {
    method: 'PATCH',
    body:   JSON.stringify({ status: 'delivered' }),
  });