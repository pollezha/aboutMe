import pluginVue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import { MODULES, moduleBoundaries } from './scripts/module-graph.mjs'

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
  // Границы модулей (ADR-0007): граф и генератор записей — scripts/module-graph.mjs,
  // тест — scripts/__tests__/layer-boundaries.spec.ts.
  ...moduleBoundaries(MODULES),
  {
    // Файл — одна мысль (ADR-0007). В .vue считается весь SFC: шаблон, скрипт и стили.
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/**/__tests__/**', 'src/theme/palette.ts', 'src/theme/pinInk.ts'],
    rules: { 'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }] },
  },
  {
    // Временно: App.vue (530 строк кода) разбирается на модули в M10–M17, исключение снимается в M17.
    files: ['src/App.vue'],
    rules: { 'max-lines': 'off' },
  },
)
