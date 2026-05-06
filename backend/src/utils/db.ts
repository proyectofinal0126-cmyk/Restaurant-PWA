import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'restaurant_pwa',
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD || 'Tdea2024'),
  client_encoding: 'UTF8',
});

pool.on('error', (err) => {
  console.error('[Database] Unexpected error:', err);
});

pool.connect()
  .then((client) => {
    console.log('✅ PostgreSQL conectado');
    client.release();
  })
  .catch((err) => {
    console.error(' Error conectando a PostgreSQL:', err.message);
  });

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;