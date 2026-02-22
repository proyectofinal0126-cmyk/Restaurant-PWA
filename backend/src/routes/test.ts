import express from 'express';
import { query } from '../utils/db';

const router = express.Router();

router.get('/tables', async (req, res) => {
  try {
    const result = await query('SELECT * FROM tables');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;