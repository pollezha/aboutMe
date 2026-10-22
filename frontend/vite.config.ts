import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    // Vitest по умолчанию отдаёт CSS пустым (даже с ?raw); tokens.css читается тестом palette.spec.
    css: { include: [/src\/theme\/tokens\.css/] },
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
  },
})
