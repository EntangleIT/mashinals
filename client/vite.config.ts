import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? '/mashinals/' : '/';
  return {
    plugins: [react()],
    base,
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
