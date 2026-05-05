// ============================================================
// backend/src/server.ts  —  Fase 9 (actualizado)
// NUEVO: /api/inventory → inventoryRoutes (ingredients, suppliers, recipes, withdrawals)
// ============================================================

import express          from 'express';
import cors             from 'cors';
import { createServer } from 'http';
import dotenv           from 'dotenv';

import authRoutes      from './routes/auth';
import menuRoutes      from './routes/menu';
import tableRoutes     from './routes/tables';
import orderRoutes     from './routes/orders';
import cashierRoutes   from './routes/cashier';
import adminRoutes     from './routes/admin';
import configRoutes    from './routes/config';
import inventoryRoutes from './routes/inventory';   // ← NUEVO Fase 9
import devRoutes       from './routes/dev';

import { initWebSocket } from './websocket/handlers';
import pool from './utils/db';

dotenv.config();

const app    = express();
const server = createServer(app);

app.use(cors({
  origin:      process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/auth',      authRoutes);
app.use('/api/menu',      menuRoutes);
app.use('/api/tables',    tableRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/cashier',   cashierRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/config',    configRoutes);
app.use('/api/inventory', inventoryRoutes);   // ← NUEVO Fase 9

if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRoutes);
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', env: process.env.NODE_ENV ?? 'development' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

initWebSocket(server);

const PORT = parseInt(process.env.PORT ?? '3001');
server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});