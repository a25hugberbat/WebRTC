import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    // En desarrollo (npm run dev) Vite va por el puerto 5173 y el servidor
    // de Socket.IO por el 3000. Este proxy reenvía /socket.io al 3000.
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
});
