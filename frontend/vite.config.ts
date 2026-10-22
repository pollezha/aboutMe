import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import templateCompilerOptions from '@tresjs/core/template-compiler-options'

export default defineConfig({
  // Теги Tres* — элементы three.js, а не компоненты Vue (TresJS).
  plugins: [vue({ ...templateCompilerOptions })],
  // manifest — для теста «three не в main-чанке» и проверок бюджета (size-limit).
  // Бюджеты чанков (main ≤ 150 КБ gzip, сцена ≤ 2 МБ) проверяет size-limit; порог предупреждения Vite — по сцене.
  build: { manifest: true, chunkSizeWarningLimit: 2048 },
  test: {
    environment: 'jsdom',
    // Vitest по умолчанию отдаёт CSS пустым (даже с ?raw); tokens.css и pins.css читает тест palette.spec.
    css: { include: [/src\/theme\/(tokens|pins)\.css/] },
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
  },
})
