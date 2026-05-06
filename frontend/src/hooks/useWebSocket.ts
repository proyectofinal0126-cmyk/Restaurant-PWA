import { useEffect, useRef, useCallback } from 'react';
import { useOrderStore } from '../store/orderStore';
import type { WsOrderStatusEvent, WsOrderReadyEvent } from '../types/order';


const WS_URL               = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001';
const RECONNECT_INITIAL_MS = 1_000;
const RECONNECT_MAX_MS     = 30_000;
const RECONNECT_MULTIPLIER = 2;

interface UseWebSocketOptions {
  orderId:         string | null;
  onStatusChange?: (event: WsOrderStatusEvent) => void;
  onReady?:        (event: WsOrderReadyEvent)  => void;
}

export function useWebSocket({ orderId, onStatusChange, onReady }: UseWebSocketOptions) {
  const wsRef            = useRef<WebSocket | null>(null);
  const reconnectDelay   = useRef(RECONNECT_INITIAL_MS);
  const reconnectTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted        = useRef(false);
  const intentionalClose = useRef(false);

  // Guardar callbacks en refs para no incluirlos en dependencias
  const updateOrderStatus = useOrderStore((s) => s.updateOrderStatus);
  const updateOrderStatusRef = useRef(updateOrderStatus);
  const onStatusChangeRef    = useRef(onStatusChange);
  const onReadyRef           = useRef(onReady);
  useEffect(() => { updateOrderStatusRef.current = updateOrderStatus; }, [updateOrderStatus]);
  useEffect(() => { onStatusChangeRef.current    = onStatusChange;    }, [onStatusChange]);
  useEffect(() => { onReadyRef.current           = onReady;           }, [onReady]);

  const connect = useCallback(() => {
    if (!orderId || !isMounted.current) return;

    const state = wsRef.current?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

    intentionalClose.current = false;
    const ws = new WebSocket(`${WS_URL}?orderId=${orderId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Conectado. orderId:', orderId);
      reconnectDelay.current = RECONNECT_INITIAL_MS;
      ws.send(JSON.stringify({ type: 'subscribe', orderId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string; payload: WsOrderStatusEvent | WsOrderReadyEvent;
        };
        switch (data.type) {
          case 'order:status': {
            const payload = data.payload as WsOrderStatusEvent;
            updateOrderStatusRef.current(payload.status);
            onStatusChangeRef.current?.(payload);
            break;
          }
          case 'order:ready': {
            const payload = data.payload as WsOrderReadyEvent;
            updateOrderStatusRef.current('ready_for_pickup');
            onReadyRef.current?.(payload);
            break;
          }
        }
      } catch {
        console.warn('[WS] Mensaje no parseable:', event.data);
      }
    };

    ws.onerror = (err) => console.error('[WS] Error:', err);

    ws.onclose = () => {
      if (!isMounted.current || intentionalClose.current) return;
      console.log('[WS] Desconectado. Reintentando en', reconnectDelay.current, 'ms');
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(
          reconnectDelay.current * RECONNECT_MULTIPLIER,
          RECONNECT_MAX_MS
        );
        connect();
      }, reconnectDelay.current);
    };
  }, [orderId]); // solo orderId como dependencia

  useEffect(() => {
    isMounted.current        = true;
    intentionalClose.current = false;
    connect();
    return () => {
      isMounted.current        = false;
      intentionalClose.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
    };
  }, [connect]);
}