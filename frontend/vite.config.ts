import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    // Vitest по умолчанию отдаёт CSS пустым (даже с ?raw); tokens.css и pins.css читает тест palette.spec.
    css: { include: [/src\/theme\/(tokens|pins)\.css/] },
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
  },
})
