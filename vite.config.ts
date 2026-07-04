import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5003',
        changeOrigin: false,
      },
      '/review-service': {
        target: 'http://127.0.0.1:5003',
        changeOrigin: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          if (id.includes('reactflow')) {
            return 'flow-vendor';
          }
          if (
            id.includes('recharts')
            || id.includes('victory-vendor')
            || id.includes('/d3-')
            || id.includes('@reduxjs/toolkit')
            || id.includes('/immer/')
            || id.includes('/reselect/')
            || id.includes('/react-is/')
          ) {
            return 'chart-vendor';
          }
          if (
            id.includes('react-router')
            || id.includes('@tanstack/react-query')
          ) {
            return 'app-vendor';
          }
          if (
            id.includes('/react/')
            || id.includes('/react-dom/')
            || id.includes('scheduler')
          ) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
