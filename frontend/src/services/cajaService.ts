// ============================================================
// frontend/src/services/cajaService.ts  —  Fase 4
// Todas las rutas requieren JWT (rol caja/admin).
// ============================================================

import { apiFetch } from './api';
import type { Order } from '../types/order';
import type {
  OrderWithMeta,
  CloseOrderPayload,
  CloseOrderResponse,
} from '../types/caja';

// Convierte Order → OrderWithMeta calculando los campos extra
function toOrderWithMeta(order: Order): OrderWithMeta {
  const elapsed = Math.floor(
    (Date.now() - new Date(order.created_at).getTime()) / 60_000
  );
  return {
    ...order,
    elapsedMinutes: elapsed,
    isUrgent:       elapsed > 20,
  };
}

// ✅ Retorna OrderWithMeta[] — compatible con cajaStore.setOrders
export const getActiveOrders = (): Promise<OrderWithMeta[]> =>
  apiFetch<Order[]>('/orders/active').then((orders) =>
    orders.map(toOrderWithMeta)
  );

export const getOrderDetail = (orderId: string): Promise<OrderWithMeta> =>
  apiFetch<Order>(`/orders/${orderId}`).then(toOrderWithMeta);

export const updateOrderStatus = (
  orderId: string,
  status: string
): Promise<Order> =>
  apiFetch<Order>(`/orders/${orderId}/status`, {
    method: 'PATCH',
    body:   JSON.stringify({ status }),
  });

export const closeOrder = (
  orderId:  string,
  payload?: CloseOrderPayload
): Promise<CloseOrderResponse> =>
  apiFetch<CloseOrderResponse>(`/orders/${orderId}/close`, {
    method: 'POST',
    body:   JSON.stringify(payload ?? {}),
  });