import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          markdown: ['react-markdown', 'remark-gfm', 'rehype-raw'],
          docProcessing: ['jszip', 'mammoth', 'turndown', 'turndown-plugin-gfm']
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