import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          if (id.includes('reactflow')) {
            return 'graph-vendor';
          }
          if (id.includes('@openuidev/')) {
            return 'chat-vendor';
          }
          if (id.includes('react-markdown') || id.includes('remark-gfm')) {
            return 'markdown-vendor';
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
          return 'vendor';
        },
      },
    },
  },
});
