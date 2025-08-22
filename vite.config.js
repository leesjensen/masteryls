import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import istanbul from 'vite-plugin-istanbul';

export default defineConfig({
  build: {
    sourcemap: process.env.COVERAGE ? true : false,
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
