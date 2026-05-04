import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      // Redirige /api/* → http://backend:3001/api/*
      // En local usa localhost:3001, en Docker usa el nombre del servicio
      '/api': {
        target: 'http://backend:3001',
        changeOrigin: true,
      },
      // WebSocket
      '/ws': {
        target: 'ws://backend:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
})