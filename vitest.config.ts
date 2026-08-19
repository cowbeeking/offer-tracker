import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domain/**/*.ts', 'src/services/backup.ts', 'src/utils/**/*.ts'],
      exclude: ['src/utils/markdownExport.tsx'],
      thresholds: {
        statements: 65,
        branches: 60,
        functions: 70,
        lines: 65,
      },
    },
  },
})
