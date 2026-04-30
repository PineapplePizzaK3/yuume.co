import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_DEV_API_PROXY || 'http://127.0.0.1:3000'

  return {
  plugins: [react(), cloudflare()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  };
})