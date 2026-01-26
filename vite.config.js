import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import istanbul from 'vite-plugin-istanbul';

export default defineConfig({
  server: {
    watch: {
      usePolling: true,
      ignored: ['**/node_modules/**', '**/coverage/**', '**/playwright-report/**', '**/test-results/**'],
    },
  },
  build: {
    sourcemap: true,
  },
  plugins: [
    tailwindcss(),
    istanbul({
      include: ['src/**/*'],
      exclude: ['node_modules'],
      requireEnv: false,
    }),
  ],
});
