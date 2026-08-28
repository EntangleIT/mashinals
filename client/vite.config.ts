import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? '/mashinals/' : '/';
  return {
    plugins: [react()],
    base,
    build: {
      chunkSizeWarningLimit: 3200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@1sat') || id.includes('node_modules/@bsv')) {
              return '1sat';
            }
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ['bun:sqlite'],
    },
    server: {
      port: 45321,
      host: '127.0.0.1',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, '/mashinals/api'),
        },
        '/mashinals/api': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 45321,
      host: '127.0.0.1',
    },
  };
});
