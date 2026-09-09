import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const sourceDirectory = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/local-markdown-workspace/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(sourceDirectory),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    css: true,
  },
})
