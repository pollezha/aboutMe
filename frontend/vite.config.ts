import type { IndexHtmlTransformContext } from 'vite'
import { defineConfig, type Plugin } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import templateCompilerOptions from '@tresjs/core/template-compiler-options'
import type { ViteSSGOptions } from 'vite-ssg'
import { scenePreloadScript } from './src/scene/preload.ts'
import { MIN_3D_MEMORY_GB, MIN_3D_WIDTH } from './src/scene/thresholds.ts'
import { bootScript } from './src/theme/boot.ts'
import { palette } from './src/theme/palette.ts'

// Время сборки — «сейчас» для дат в тексте (src/content/buildTime.ts). vite-ssg собирает клиент и сервер
// отдельными проходами и каждый раз заново читает конфиг — значение кладём в globalThis, чтобы оно совпало.
const shared = globalThis as { aboutmeBuildTime?: string }
const buildTime = (shared.aboutmeBuildTime ??= new Date().toISOString())

const SCENE_LIMITS = { minWidth: MIN_3D_WIDTH, minMemory: MIN_3D_MEMORY_GB }

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
  let base = '/'
  return {
    name: 'aboutme-boot-script',
    configResolved(config) {
      base = config.base
    },
    // Хук без order выполняется на этапе generateBundle: в сборке ctx.bundle уже знает имя чанка сцены.
    transformIndexHtml(html, ctx) {
      if (!html.includes(BOOT_MARKER)) throw new Error(`index.html: no ${BOOT_MARKER} marker`)
      const urls = sceneChunkUrls(ctx.bundle, base)
      const preload = urls.length
        ? `<script>${scenePreloadScript(urls, SCENE_LIMITS)}</script>`
        : ''
      return html.replace(BOOT_MARKER, () => `<script>${bootScript(colors)}</script>${preload}`)
    },
  }
}

/**
 * Чанк 3D-сцены (динамический импорт src/scene/Scene.vue), его статические зависимости кроме входа и CSS —
 * для preload из <head> (src/scene/preload.ts). В dev bundle нет — preload не нужен.
 */
function sceneChunkUrls(bundle: IndexHtmlTransformContext['bundle'], base: string): string[] {
  if (!bundle) return []
  const chunks = Object.values(bundle).filter((item) => item.type === 'chunk')
  const scene = chunks.find((chunk) => chunk.facadeModuleId?.endsWith('/src/scene/Scene.vue'))
  if (!scene) return []
  const entries = new Set(chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName))
  const files = [
    scene.fileName,
    ...scene.imports.filter((file) => !entries.has(file)),
    ...(scene.viteMetadata?.importedCss ?? []),
  ]
  return files.map((file) => base + file)
}

/**
 * TresJS тянет в чанк сцены отладочный код, которого прод не вызывает (~30 КБ gzip, T12b): @tresjs/core —
 * Vue devtools (@vue/devtools-api → devtools-kit, регистрация плагина), @tresjs/cientos — FPS-мониторы stats-gl
 * и stats.js (компоненты Stats/StatsGl, сцена их не использует). В сборке эти импорты внутри @tresjs/*
 * заменяются пустыми модулями; dev-сервер, тесты и devtools других пакетов не затронуты.
 */
function tresDevOnlyStubsPlugin(): Plugin {
  const STUBS: Record<string, string> = {
    '@vue/devtools-api': 'export function setupDevtoolsPlugin() {}',
    'stats-gl': 'export default class Stats {}',
    'stats.js': 'export default class Stats {}',
  }
  const PREFIX = '\0aboutme-stub:'
  return {
    name: 'aboutme-tres-dev-only-stubs',
    apply: 'build',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!(source in STUBS) || !importer?.replaceAll('\\', '/').includes('/node_modules/@tresjs/'))
        return null
      return PREFIX + source
    },
    load(id) {
      return id.startsWith(PREFIX) ? STUBS[id.slice(PREFIX.length)] : null
    },
  }
}

const PRELOAD_LINK = /<link rel="preload"[^>]*>\s*/g
const ENTRY_SCRIPT = '<script type="module"'

/**
 * Preload-ссылки, которые head.ts ставит через unhead (шрифты текста), vite-ssg дописывает в конец <head> —
 * после main-чанка. Переносим их выше скрипта: запрос шрифта уходит раньше (T12b).
 */
function hoistPreloads(html: string): string {
  const entry = html.indexOf(ENTRY_SCRIPT)
  if (entry < 0) return html
  const links = html.slice(entry).match(PRELOAD_LINK)
  if (!links) return html
  const rest = html.slice(entry).replace(PRELOAD_LINK, '')
  return html.slice(0, entry) + links.map((link) => link.trim()).join('') + rest
}

export default defineConfig({
  // Теги Tres* — элементы three.js, а не компоненты Vue (TresJS).
  plugins: [vue({ ...templateCompilerOptions }), bootScriptPlugin(), tresDevOnlyStubsPlugin()],
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
    // Флаги esm-bundler-сборок: из main-чанка уходит лишнее (T12b). Options API не используется (только
    // <script setup>); у vue-i18n — только Composition API без <i18n-t>/v-t, а вместо компилятора сообщений
    // (~17 КБ) — свой для `{name}` (src/i18n/compile.ts).
    __VUE_OPTIONS_API__: 'false',
    __VUE_I18N_FULL_INSTALL__: 'false',
    __VUE_I18N_LEGACY_API__: 'false',
    __INTLIFY_DROP_MESSAGE_COMPILER__: 'true',
    __INTLIFY_PROD_DEVTOOLS__: 'false',
  },
  // manifest — для теста «three не в main-чанке» и проверок бюджета (size-limit).
  // Бюджеты чанков (main ≤ 150 КБ gzip, сцена ≤ 2 МБ) проверяет size-limit; порог предупреждения Vite — по сцене.
  build: { manifest: true, chunkSizeWarningLimit: 2048 },
  // Предрендер: `/` → dist/index.html, `/ru/` → dist/ru/index.html. Критический CSS (beasties) выключен:
  // стили первого экрана и так в одном CSS-файле (6.5 КБ gzip), а beasties — необязательная peer-зависимость
  // vite-ssg, в проекте её нет.
  ssgOptions: {
    dirStyle: 'nested',
    beastiesOptions: false,
    onPageRendered: (_route, html) => hoistPreloads(html),
  } satisfies ViteSSGOptions,
  test: {
    environment: 'jsdom',
    // Vitest по умолчанию отдаёт CSS пустым (даже с ?raw); tokens.css и pins.css читает тест palette.spec.
    css: { include: [/src\/theme\/(tokens|pins)\.css/] },
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
  },
})
