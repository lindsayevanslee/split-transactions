/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/split-transactions/',
  build: {
    // esbuild 0.28+ errors when down-transforming modern destructuring (used by
    // react-router 7) to the old default target (es2020). es2022 is supported by
    // all current evergreen browsers and avoids that transform entirely.
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
