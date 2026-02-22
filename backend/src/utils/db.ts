import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on('error', (err) => {
  console.error('[Database] Unexpected error:', err);
});

pool.on('connect', () => {
  console.log('[Database] Connected to PostgreSQL');
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;