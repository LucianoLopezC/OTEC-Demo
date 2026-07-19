import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        // Divide el bundle monolítico en chunks estables por librería
        // manualChunks como función (requerido por rolldown / Vite 8)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) {
              return 'vendor-react'
            }
            if (id.includes('/jspdf/') || id.includes('/html2canvas/')) {
              return 'vendor-pdf'
            }
            if (id.includes('/xlsx/')) {
              return 'vendor-xlsx'
            }
            if (id.includes('/@tiptap/')) {
              return 'vendor-tiptap'
            }
            if (id.includes('/recharts/') || id.includes('/d3-')) {
              return 'vendor-charts'
            }
            if (id.includes('/jszip/')) {
              return 'vendor-zip'
            }
            if (id.includes('/docxtemplater/') || id.includes('/pizzip/')) {
              return 'vendor-docx'
            }
          }
        },
      },
    },
  },

  server: {
    headers: {
      'X-Content-Type-Options':  'nosniff',
      'X-Frame-Options':         'DENY',
      'X-XSS-Protection':        '1; mode=block',
      'Referrer-Policy':         'strict-origin-when-cross-origin',
      'Permissions-Policy':      'camera=(), microphone=(), geolocation=()',
    },
  },

  preview: {
    headers: {
      'X-Content-Type-Options':  'nosniff',
      'X-Frame-Options':         'DENY',
      'X-XSS-Protection':        '1; mode=block',
      'Referrer-Policy':         'strict-origin-when-cross-origin',
      'Permissions-Policy':      'camera=(), microphone=(), geolocation=()',
    },
  },
})
