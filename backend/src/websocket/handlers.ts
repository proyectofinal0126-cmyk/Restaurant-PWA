// ============================================================
// backend/src/websocket/handlers.ts
//
// CAMBIO FASE 6: isGlobalRole ahora incluye 'mesero'.
// El dashboard de mesas necesita recibir broadcast global de:
//   - order:status  → para actualizar el estado en las tarjetas
//   - table:status  → para actualizar el grid en tiempo real
//
// Sin este cambio, useWaiterWebSocket no recibe nada porque
// el mesero conectado no tenía rol en isGlobalRole.
// ============================================================

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server }    from 'http';

interface WsClient extends WebSocket {
  isAlive:  boolean;
  orderId?: string; // orden a la que está suscrito (cliente tracker)
  role?:    string; // rol del usuario (personal)
}

interface BroadcastOptions {
  type:           string;
  payload:        unknown;
  targetOrderId?: string; // si se especifica, solo va a clientes de esa orden
}

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WsClient, req: IncomingMessage) => {
    ws.isAlive = true;

    // Extraer orderId y role del query string
    const url  = new URL(req.url ?? '/', 'http://localhost');
    const oId  = url.searchParams.get('orderId');
    const role = url.searchParams.get('role');

    if (oId)  ws.orderId = oId;
    if (role) ws.role    = role; // permite pre-identificar el rol en la URL

    console.log(
      `[WS] Conectado — role: ${ws.role ?? 'cliente'} | orderId: ${ws.orderId ?? 'ninguno'}`
    );

    ws.send(JSON.stringify({ type: 'connected', payload: { orderId: ws.orderId } }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string; orderId?: string; role?: string;
        };

        if (msg.type === 'subscribe' && msg.orderId) {
          ws.orderId = msg.orderId;
          console.log(`[WS] Suscripción a orden: ${msg.orderId}`);
        }

        // Permite al cliente establecer el rol después de conectarse
        if (msg.type === 'role' && msg.role) {
          ws.role = msg.role;
          console.log(`[WS] Rol asignado: ${msg.role}`);
        }
      } catch {
        // ignorar mensajes malformados
      }
    });

    ws.on('pong',  () => { ws.isAlive = true; });
    ws.on('close', () => {
      console.log(`[WS] Desconectado — role: ${ws.role ?? 'cliente'} | orderId: ${ws.orderId ?? 'ninguno'}`);
    });
    ws.on('error', (err) => {
      console.error('[WS] Error en cliente:', err.message);
    });
  });

  // Heartbeat — detectar conexiones muertas cada 30s
  const heartbeat = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((client) => {
      const ws = client as WsClient;
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));
  console.log('[WS] Servidor WebSocket iniciado');
}

/**
 * Envía un mensaje a los clientes relevantes.
 *
 * Con targetOrderId:
 *   → Clientes suscritos a esa orden (cliente en tracker)
 *   → Roles globales: caja, cocina, mesero, admin
 *
 * Sin targetOrderId:
 *   → Broadcast a TODOS los clientes conectados
 *
 * FASE 6: 'mesero' añadido a isGlobalRole para recibir:
 *   - order:status (sincronizar estado de mesas)
 *   - table:status (sincronizar grid de mesas)
 */
export function broadcast(options: BroadcastOptions): void {
  if (!wss) return;

  const { type, payload, targetOrderId } = options;
  const message = JSON.stringify({ type, payload });

  wss.clients.forEach((client) => {
    const ws = client as WsClient;
    if (ws.readyState !== WebSocket.OPEN) return;

    if (!targetOrderId) {
      ws.send(message);
      return;
    }

    const isSubscribed = ws.orderId === targetOrderId;
    // FIX FASE 6: 'mesero' añadido para que reciba broadcasts globales
    const isGlobalRole =
      ws.role === 'caja'   ||
      ws.role === 'cocina' ||
      ws.role === 'mesero' ||   // ← NUEVO
      ws.role === 'admin';

    if (isSubscribed || isGlobalRole) {
      ws.send(message);
    }
  });
}