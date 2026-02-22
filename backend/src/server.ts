import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import testRoutes from './routes/test';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Rutas básicas
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend running' });
});

app.use('/api/test', testRoutes);


// Iniciar servidor
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Environment] ${process.env.NODE_ENV}`);
});