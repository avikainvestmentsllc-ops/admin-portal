import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react';

// Dev server proxies API calls to the Spring Boot backend so the browser talks
// to a single origin during development.
export default defineConfig(() => {

  const apiBase = 'http://localhost:8090'

  return {
    plugins: [react()],
    server: {
      port: 5200,
      // Fail loudly if 5200 is taken instead of silently moving to another port,
      // which would change the origin all relative API calls resolve against.
      strictPort: true,
      proxy: {
        // Must match the API prefix the app actually calls (/managehouselease/*).
        '/managehouselease': {
          target: apiBase,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
