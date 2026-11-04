/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// A API roda à parte (uv run fastapi dev app/main.py --port 8010). No desenvolvimento, /api/* é
// encaminhado para ela sem o prefixo, então a API não precisa de CORS. Portas próprias (8010/5180),
// fora das padrão 8000/5173, que costumam estar ocupadas por outros projetos nesta máquina.
const API_URL = process.env.API_URL ?? 'http://localhost:8010'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: 'localhost',
    port: 5180,
    // Falha em vez de pular para outra porta sem avisar.
    strictPort: true,
    proxy: {
      '/api': {
        target: API_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/teste/setup.ts'],
  },
})
