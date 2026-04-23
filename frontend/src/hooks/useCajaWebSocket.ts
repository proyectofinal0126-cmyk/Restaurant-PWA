// frontend/src/hooks/useCajaWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { useCajaStore } from '../store/cajaStore';
import { getOrderDetail } from '../services/cajaService';
import type { OrderStatus } from '../types/order';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001';

export function useCajaWebSocket(token: string | null) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectDelay = useRef(1_000);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMounted = useRef(true);

    const { addOrder, updateStatus, removeOrder } = useCajaStore();

    const connect = useCallback(() => {
        if (!token || !isMounted.current) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        // ✅ Sin espacio, sin slash extra
        const ws = new WebSocket(`${WS_URL}?role=caja`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('[WS Caja] Conectado');
            reconnectDelay.current = 1_000;
            ws.send(JSON.stringify({ type: 'role', role: 'caja' }));
        };

        ws.onmessage = ({ data }) => {
            try {
                const { type, payload } = JSON.parse(data as string) as {
                    type: string;
                    payload: Record<string, unknown>;
                };

                switch (type) {

                    // ✅ FIX: en vez de construir el objeto manualmente,
                    // pedimos la orden completa al backend
                    case 'order:new': {
                        const orderId = payload.orderId as string;
                        getOrderDetail(orderId)
                            .then((fullOrder) => {
                                if (isMounted.current) addOrder({
                                    ...fullOrder,
                                    elapsedMinutes: 0,
                                    isUrgent: false,
                                });
                            })
                            .catch((e) => console.error('[WS Caja] Error cargando order:new', e));
                        break;
                    }

                    case 'order:status': {
                        const status = payload.status as OrderStatus;
                        const orderId = payload.orderId as string;
                        if (['completed', 'cancelled'].includes(status)) {
                            removeOrder(orderId);
                        } else {
                            updateStatus(orderId, status);
                        }
                        break;
                    }

                    default: break;
                }
            } catch {
                console.warn('[WS Caja] Mensaje no parseable:', data);
            }
        };

        ws.onerror = (e) => console.error('[WS Caja] Error:', e);

        ws.onclose = () => {
            if (!isMounted.current) return;
            console.log(`[WS Caja] Desconectado. Reintentando en ${reconnectDelay.current}ms`);
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