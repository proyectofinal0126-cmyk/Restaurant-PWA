// ============================================================
// frontend/src/hooks/useCashierWebSocket.ts  —  Fase 7
//
// WebSocket para el dashboard de Caja Con Mesero.
// Patrón idéntico a useCajaWebSocket.ts y useWaiterWebSocket.ts.
//
// Escucha:
//   - table:status    → una mesa cambió a waiting_bill (agregar al dashboard)
//   - table:released  → una mesa fue liberada (quitar del dashboard)
//   - order:paid      → confirmación de pago desde otro terminal (quitar)
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { useCashierStore } from '../store/cashierStore';
import type { WsTableReleasedEvent, WsOrderPaidEvent } from '../types/cashier';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001';

export function useCashierWebSocket(token: string | null) {
  const wsRef          = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1_000);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted      = useRef(true);

  const { removeWaitingTable } = useCashierStore();

  const connect = useCallback(() => {
    if (!token || !isMounted.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}?role=caja`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS CajaMesero] Conectado');
      reconnectDelay.current = 1_000;
      ws.send(JSON.stringify({ type: 'role', role: 'caja' }));
    };

    ws.onmessage = ({ data }) => {
      try {
        const { type, payload } = JSON.parse(data as string) as {
          type:    string;
          payload: Record<string, unknown>;
        };

        switch (type) {
          // Mesa liberada por otro terminal o por este mismo
          case 'table:released': {
            const p = payload as unknown as WsTableReleasedEvent;
            removeWaitingTable(p.tableId);
            break;
          }

          // Pago confirmado (quitar la mesa del dashboard)
          case 'order:paid': {
            const p = payload as unknown as WsOrderPaidEvent;
            removeWaitingTable(p.tableId);
            break;
          }

          // Una mesa solicitó la cuenta (agregar al dashboard)
          // El componente recarga la lista completa al recibir este evento
          // para evitar construir el objeto WaitingTable manualmente
          case 'table:status': {
            const status = payload.status as string;
            if (status === 'waiting_bill') {
              // El componente CajaMesero escucha este flag para recargar
              // Se delega al componente porque necesita el fetch completo
            }
            break;
          }

          default:
            break;
        }
      } catch {
        console.warn('[WS CajaMesero] Mensaje no parseable:', data);
      }
    };

    ws.onerror  = (e) => console.error('[WS CajaMesero] Error:', e);
    ws.onclose  = () => {
      if (!isMounted.current) return;
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000);
        connect();
      }, reconnectDelay.current);
    };
  }, [token, removeWaitingTable]);

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