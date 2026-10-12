import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * VITE_BASE: caminho base do site (ex.: "/gtaiv-site/" no GitHub Pages; "/" com domínio próprio).
 * VITE_DATA_MODE: "snapshot" (site estático, lê /data/*.json) ou "api" (lê a API ao vivo).
 * VITE_API_URL: endereço da API quando ela está em outra origem. Vazio = mesma origem.
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/go': 'http://localhost:8787',
      '/media': 'http://localhost:8787',
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
});
