import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // AÑADIDO: en desarrollo (npm run dev) Vite va por el puerto 5173 y el
  // servidor de Socket.IO por el 20121. Este proxy reenvía /socket.io al 20121.
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:20121',
        ws: true,
      },
    },
  },
})
