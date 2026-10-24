import pluginVue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

// Границы слоёв src/ (тест: scripts/__tests__/layer-boundaries.spec.ts). Импорты в слоях относительные,
// поэтому слой узнаём по префиксу «./» или «../»: `../stores/ui` — слой stores, а не ui.
const layer = (name) => `^(\.\.?/)+${name}(/|$)`
const THREE = '^(three|@tresjs/[^/]+)(/|$)'

const ban = (regex, message) => ({ regex, message })
const no3d = ban(THREE, 'three.js и TresJS — только в src/scene (чанк сцены грузится лениво).')
const noLayer = (name, why) => ban(layer(name), `Слой ${name} отсюда недоступен: ${why}`)

/**
 * Одна запись конфигурации на слой: опции правила из разных записей не сливаются (побеждает последняя),
 * поэтому полный список запретов слоя собирается здесь. import() правило не видит — его ловит
 * no-restricted-syntax: three/TresJS и сцену динамически грузит только src/scene/index.ts.
 */
const boundary = (files, patterns) => ({
  files,
  ignores: ['src/**/__tests__/**'],
  rules: {
    'no-restricted-imports': ['error', { patterns }],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ImportExpression[source.value=/^(three|@tresjs)/]',
        message: 'Динамический импорт three.js/TresJS — только из src/scene/index.ts.',
      },
      {
        selector: 'ImportExpression[source.value=/^[.][.]?[/]([.][.][/])*scene([/]|$)/]',
        message: 'Сцену лениво грузит только src/scene/index.ts (loadSceneWhenIdle).',
      },
    ],
  },
})

const bottom = 'нижний слой не зависит от верхних.'

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '.lighthouseci/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    // Форматирование — зона Prettier, стилистические правила vue отключены, чтобы не спорить с ним.
    rules: {
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-self-closing': 'off',
    },
  },
  // Корень приложения (App.vue, main.ts, router.ts, head.ts) — в главном чанке: от сцены берёт только
  // ленивую точку входа и лёгкие модули без three.js.
  boundary(
    ['src/*.{ts,vue}'],
    [
      no3d,
      ban(
        '^\./scene/(?!(index|shouldUse3D|useCamera)$)',
        'Из корня сцена доступна только через ./scene (ленивая загрузка), ./scene/shouldUse3D и ./scene/useCamera.',
      ),
    ],
  ),
  boundary(
    ['src/fallback2d/**/*.{ts,vue}'],
    [
      no3d,
      noLayer('scene', '2D-режим не тянет three.js.'),
      noLayer('ui', 'карта 2D не зависит от окон.'),
    ],
  ),
  boundary(
    ['src/ui/**/*.{ts,vue}'],
    [
      no3d,
      noLayer('scene', 'UI в главном чанке, сцена — в ленивом.'),
      noLayer('fallback2d', 'режим выбирает App.vue.'),
    ],
  ),
  boundary(
    ['src/stores/**/*.{ts,vue}'],
    [
      no3d,
      ...['ui', 'scene', 'fallback2d', 'i18n'].map((name) =>
        noLayer(name, 'стор не знает о представлении.'),
      ),
      ban('\.vue$', 'Стор не импортирует компоненты.'),
    ],
  ),
  boundary(
    ['src/i18n/**/*.{ts,vue}'],
    [no3d, ...['ui', 'scene', 'fallback2d'].map((name) => noLayer(name, bottom))],
  ),
  boundary(
    ['src/content/**/*.{ts,vue}', 'src/theme/**/*.{ts,vue}'],
    [no3d, ...['ui', 'scene', 'stores', 'fallback2d', 'i18n'].map((name) => noLayer(name, bottom))],
  ),
)
