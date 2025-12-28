import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor';
            }
            if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('rehype-raw')) {
              return 'markdown';
            }
            if (id.includes('jszip') || id.includes('mammoth') || id.includes('turndown')) {
              return 'docProcessing';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: ['jszip', 'mammoth', 'turndown', 'turndown-plugin-gfm']
  },
  server: {
    fs: {
      strict: false
    }
  }
})