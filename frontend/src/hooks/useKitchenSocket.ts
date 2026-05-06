// ============================================================
// frontend/src/hooks/useKitchenSocket.ts  —  Fase 5: KDS
//
// FIXES:
//  1. React StrictMode: el doble mount desmontaba el WS antes de
//     que terminara de conectarse → ahora se verifica readyState
//     antes de cerrar y se usa un flag `intentionalClose`.
//  2. Las funciones del store (addOrder, updateStatus, removeOrder)
//     cambiaban de referencia en cada render → ahora se guardan
//     en refs y se excluyen de las dependencias del useCallback,
//     evitando el loop de reconexión.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { useKitchenStore } from '../store/kitchenStore';
import { apiFetch }        from '../services/api';
import type { Order, OrderStatus } from '../types/order';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001';

export function useKitchenSocket(token: string | null) {
  const wsRef            = useRef<WebSocket | null>(null);
  const reconnectDelay   = useRef(1_000);
  const reconnectTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted        = useRef(false);
  const intentionalClose = useRef(false);   // FIX: distinguir cierre manual de caída

  // FIX: guardar las funciones del store en refs para no incluirlas
  // en las dependencias de useCallback (evita loop de reconexión)
  const { addOrder, updateStatus, removeOrder } = useKitchenStore();
  const addOrderRef     = useRef(addOrder);
  const updateStatusRef = useRef(updateStatus);
  const removeOrderRef  = useRef(removeOrder);
  useEffect(() => { addOrderRef.current     = addOrder;     }, [addOrder]);
  useEffect(() => { updateStatusRef.current = updateStatus; }, [updateStatus]);
  useEffect(() => { removeOrderRef.current  = removeOrder;  }, [removeOrder]);

  const connect = useCallback(() => {
    if (!token || !isMounted.current) return;

    // FIX: no abrir si ya hay una conexión activa o en proceso
    const state = wsRef.current?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

    intentionalClose.current = false;
    const ws = new WebSocket(`${WS_URL}?role=cocina`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS Cocina] Conectado');
      reconnectDelay.current = 1_000;
      ws.send(JSON.stringify({ type: 'role', role: 'cocina' }));
    };

    ws.onmessage = ({ data }) => {
      try {
        const { type, payload } = JSON.parse(data as string) as {
          type:    string;
          payload: Record<string, unknown>;
        };

        switch (type) {
          case 'order:new': {
            const orderId = payload.orderId as string;
            apiFetch<Order>(`/orders/${orderId}`)
              .then((fullOrder) => {
                if (
                  isMounted.current &&
                  ['sent_to_kitchen', 'in_preparation'].includes(fullOrder.status)
                ) {
                  addOrderRef.current(fullOrder);
                }
              })
              .catch((e) => console.error('[WS Cocina] order:new fetch error', e));
            break;
          }

          case 'order:status': {
            const status  = payload.status  as OrderStatus;
            const orderId = payload.orderId as string;
            const kdsStatuses: OrderStatus[] = [
              'sent_to_kitchen', 'in_preparation', 'ready_for_pickup',
            ];
            if (['completed', 'cancelled'].includes(status)) {
              removeOrderRef.current(orderId);
            } else if (kdsStatuses.includes(status)) {
              updateStatusRef.current(orderId, status);
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

    ws.onerror = (e) => console.error('[WS Cocina] Error:', e);

    ws.onclose = () => {
      // FIX: no reconectar si el cierre fue intencional (cleanup del componente)
      if (!isMounted.current || intentionalClose.current) return;
      console.log(`[WS Cocina] Desconectado. Reintentando en ${reconnectDelay.current}ms`);
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000);
        connect();
      }, reconnectDelay.current);
    };
  }, [token]); // FIX: solo token como dependencia

  useEffect(() => {
    isMounted.current = true;
    connect();
    return () => {
      isMounted.current        = false;
      intentionalClose.current = true;   // FIX: marcar cierre como intencional
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      // FIX: solo cerrar si la conexión existe y no está ya cerrada
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
    };
  }, [connect]);
}