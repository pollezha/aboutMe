import { defineConfig, type Plugin } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import templateCompilerOptions from '@tresjs/core/template-compiler-options'
import type { ViteSSGOptions } from 'vite-ssg'
import { bootScript } from './src/theme/boot.ts'
import { palette } from './src/theme/palette.ts'

// Время сборки — «сейчас» для дат в тексте (src/content/buildTime.ts). vite-ssg собирает клиент и сервер
// отдельными проходами и каждый раз заново читает конфиг — значение кладём в globalThis, чтобы оно совпало.
const shared = globalThis as { aboutmeBuildTime?: string }
const buildTime = (shared.aboutmeBuildTime ??= new Date().toISOString())

const BOOT_MARKER = '<!-- boot-script -->'

/**
 * Inline-скрипт темы и языка (src/theme/boot.ts) на место метки в index.html: после charset/viewport и
 * meta#theme-color, но до любых стилей. Цвета — из палитры, литералы руками не дублируются.
 */
function bootScriptPlugin(): Plugin {
  const colors = {
    day: palette.day['bg/canvas'],
    evening: palette.evening['bg/canvas'],
    night: palette.night['bg/canvas'],
  }
  return {
    name: 'aboutme-boot-script',
    transformIndexHtml(html) {
      if (!html.includes(BOOT_MARKER)) throw new Error(`index.html: no ${BOOT_MARKER} marker`)
      return html.replace(BOOT_MARKER, () => `<script>${bootScript(colors)}</script>`)
    },
  }
}

export default defineConfig({
  // Теги Tres* — элементы three.js, а не компоненты Vue (TresJS).
  plugins: [vue({ ...templateCompilerOptions }), bootScriptPlugin()],
  define: { __BUILD_TIME__: JSON.stringify(buildTime) },
  // manifest — для теста «three не в main-чанке» и проверок бюджета (size-limit).
  // Бюджеты чанков (main ≤ 150 КБ gzip, сцена ≤ 2 МБ) проверяет size-limit; порог предупреждения Vite — по сцене.
  build: { manifest: true, chunkSizeWarningLimit: 2048 },
  // Предрендер: `/` → dist/index.html, `/ru/` → dist/ru/index.html. Критический CSS (beasties) не нужен:
  // стили первого экрана и так в одном CSS-файле.
  ssgOptions: { dirStyle: 'nested', beastiesOptions: false } satisfies ViteSSGOptions,
  test: {
    environment: 'jsdom',
    // Vitest по умолчанию отдаёт CSS пустым (даже с ?raw); tokens.css и pins.css читает тест palette.spec.
    css: { include: [/src\/theme\/(tokens|pins)\.css/] },
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
  },
})
