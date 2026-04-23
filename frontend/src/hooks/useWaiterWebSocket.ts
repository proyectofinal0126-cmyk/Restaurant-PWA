// ============================================================
// frontend/src/hooks/useWaiterWebSocket.ts  —  Fix 1 & 3
//
// FIX 1: Escucha table:status con status='occupied' para
//   actualizar la tarjeta de mesa inmediatamente cuando
//   el mesero crea una orden (backend ahora emite ese evento).
//
// FIX 3: Escucha order:status y actualiza current_order_status
//   en la tarjeta de la mesa para mostrar el progreso en tiempo
//   real (En cocina / Preparando / Listo).
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { useWaiterStore } from '../store/waiterStore';
import type { OrderStatus } from '../types/order';
import type { TableStatus } from '../types/table';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001';

export function useWaiterWebSocket(token: string | null) {
  const wsRef          = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1_000);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted      = useRef(true);

  const { updateTableStatus } = useWaiterStore();

  const connect = useCallback(() => {
    if (!token || !isMounted.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}?role=mesero`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS Mesero] Conectado');
      reconnectDelay.current = 1_000;
      ws.send(JSON.stringify({ type: 'role', role: 'mesero' }));
    };

    ws.onmessage = ({ data }) => {
      try {
        const { type, payload } = JSON.parse(data as string) as {
          type:    string;
          payload: Record<string, unknown>;
        };

        switch (type) {

          // FIX 3: Cambio de status de una orden
          // Actualiza el badge de estado en la tarjeta de la mesa
          case 'order:status': {
            const status  = payload.status  as OrderStatus;
            const tableId = payload.tableId as string | null;

            if (!tableId) break; // orden de autoservicio sin mesa

            if (['completed', 'cancelled'].includes(status)) {
              // La mesa vuelve a available (la libera caja)
              updateTableStatus(tableId, 'available', {
                current_order_id:     null,
                current_order_number: null,
                current_order_status: null,
              });
            } else {
              // FIX 3: Actualizar solo el badge de estado — la mesa sigue 'occupied'
              updateTableStatus(tableId, 'occupied', {
                current_order_status: status,
              });
            }
            break;
          }

          // FIX 1: Backend emite table:status cuando se crea una orden
          // Esto actualiza la tarjeta de mesa en tiempo real
          case 'table:status': {
            const tableId    = payload.tableId as string;
            const tableStatus = payload.status as TableStatus;
            const extra: Record<string, unknown> = {};

            // Si viene con datos de la orden, incluirlos
            if (payload.orderId)     extra.current_order_id     = payload.orderId;
            if (payload.orderNumber) extra.current_order_number = payload.orderNumber;
            if (payload.orderStatus) extra.current_order_status = payload.orderStatus;

            // Si se libera la mesa, limpiar datos de la orden
            if (tableStatus === 'available') {
              extra.current_order_id     = null;
              extra.current_order_number = null;
              extra.current_order_status = null;
            }

            updateTableStatus(tableId, tableStatus, extra);
            break;
          }

          // Mesa liberada por caja
          case 'table:released': {
            const tableId = payload.tableId as string;
            updateTableStatus(tableId, 'available', {
              current_order_id:     null,
              current_order_number: null,
              current_order_status: null,
            });
            break;
          }

          default:
            break;
        }
      } catch {
        console.warn('[WS Mesero] Mensaje no parseable:', data);
      }
    };

    ws.onerror  = (e) => console.error('[WS Mesero] Error:', e);
    ws.onclose  = () => {
      if (!isMounted.current) return;
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000);
        connect();
      }, reconnectDelay.current);
    };
  }, [token, updateTableStatus]);

  useEffect(() => {
    isMounted.current = true;
    connect();
    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}