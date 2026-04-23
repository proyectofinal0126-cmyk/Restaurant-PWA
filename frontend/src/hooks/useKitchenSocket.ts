// ============================================================
// frontend/src/hooks/useKitchenSocket.ts  —  Fase 5: KDS
//
// Hook WebSocket para la pantalla de cocina.
// Patrón idéntico a useCajaWebSocket pero para role=cocina:
// - NO usa socket.io-client (el proyecto usa ws nativo)
// - Se conecta con ?role=cocina → el servidor le envía
//   broadcast global de todas las órdenes
// - Reconexión automática con backoff exponencial 1s→30s
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { useKitchenStore } from '../store/kitchenStore';
import { apiFetch }        from '../services/api';
import type { Order, OrderStatus } from '../types/order';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001';

export function useKitchenSocket(token: string | null) {
  const wsRef          = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1_000);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted      = useRef(true);

  const { addOrder, updateStatus, removeOrder } = useKitchenStore();

  const connect = useCallback(() => {
    if (!token || !isMounted.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // role=cocina → el servidor envía todos los eventos (broadcast global)
    const ws = new WebSocket(`${WS_URL}?role=cocina`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS Cocina] Conectado');
      reconnectDelay.current = 1_000;
      // Identificarse para recibir broadcast global
      ws.send(JSON.stringify({ type: 'role', role: 'cocina' }));
    };

    ws.onmessage = ({ data }) => {
      try {
        const { type, payload } = JSON.parse(data as string) as {
          type:    string;
          payload: Record<string, unknown>;
        };

        switch (type) {
          // Nueva orden enviada a cocina
          // Cargamos el detalle completo para tener los items con nombre
          case 'order:new': {
            const orderId = payload.orderId as string;
            apiFetch<Order>(`/orders/${orderId}`)
              .then((fullOrder) => {
                // Solo mostrar en KDS si el status ya es de cocina
                if (
                  isMounted.current &&
                  ['sent_to_kitchen', 'in_preparation'].includes(fullOrder.status)
                ) {
                  addOrder(fullOrder);
                }
              })
              .catch((e) => console.error('[WS Cocina] order:new fetch error', e));
            break;
          }

          // Cambio de status — puede venir de caja o del mismo KDS
          case 'order:status': {
            const status  = payload.status  as OrderStatus;
            const orderId = payload.orderId as string;

            // Los estados que KDS debe mostrar
            const kdsStatuses: OrderStatus[] = [
              'sent_to_kitchen',
              'in_preparation',
              'ready_for_pickup',
            ];

            if (['completed', 'cancelled'].includes(status)) {
              removeOrder(orderId);
            } else if (kdsStatuses.includes(status)) {
              updateStatus(orderId, status);
            }
            break;
          }

          default:
            break;
        }
      } catch {
        console.warn('[WS Cocina] Mensaje no parseable:', data);
      }
    };

    ws.onerror  = (e) => console.error('[WS Cocina] Error:', e);

    ws.onclose  = () => {
      if (!isMounted.current) return;
      console.log(`[WS Cocina] Desconectado. Reintentando en ${reconnectDelay.current}ms`);
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000);
        connect();
      }, reconnectDelay.current);
    };
  }, [token, addOrder, updateStatus, removeOrder]);

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