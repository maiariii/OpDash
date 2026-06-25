// client/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/opdash/',
  plugins: [
    react(),
    {
      name: 'redirect-to-slashed-base',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/opdash') {
            res.writeHead(302, { Location: '/opdash/' });
            res.end();
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    proxy: {
      '/opdash/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/opdash/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      }
    }
  }
})