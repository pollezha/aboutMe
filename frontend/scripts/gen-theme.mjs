// Генерирует src/theme/palette.ts, src/theme/tokens.css, src/theme/pinInk.ts и src/theme/pins.css
// из снимка Figma scripts/design/figma-tokens.json.
// Детерминирован: порядок ключей = порядок в JSON, вывод прогоняется через Prettier проекта,
// поэтому повторный запуск не меняет файлы (CI: `npm run gen:theme && git diff --exit-code`).
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { contrastRatio } from '../src/theme/contrast.ts'

const root = new URL('../', import.meta.url)
const tokens = JSON.parse(await readFile(new URL('scripts/design/figma-tokens.json', root), 'utf8'))

const HEADER = 'GENERATED from figma-tokens.json by scripts/gen-theme.mjs — do not edit.'

/** Значение Layout-переменной в CSS: числа — px, строки — в кавычках. */
function layoutValue(token) {
  if (token.type === 'FLOAT') return `${token.value}px`
  if (token.type === 'STRING') return `'${String(token.value).replace(/'/g, "\\'")}'`
  throw new Error(`Unsupported layout token type: ${token.type}`)
}

const themes = tokens.modes.map((mode) => ({ mode, name: mode.toLowerCase() }))
const semantic = Object.entries(tokens.semantic)
const layout = Object.entries(tokens.layout)
const effects = Object.entries(tokens.effectStyles)

// Цвет номера на пине/метке главы: из двух текстовых токенов — тот, что контрастнее на цвете главы
// в данной теме. Считается по снимку, а не в рантайме: тема переключается атрибутом data-theme.
const PIN_INKS = ['on-dark', 'on-accent']
const chapters = semantic
  .filter(([key]) => key.startsWith('chapter/'))
  .map(([key, t]) => ({ id: key.slice('chapter/'.length), token: t }))

function pinInk(mode, chapterToken) {
  const ratio = (ink) => contrastRatio(tokens.semantic[`text/${ink}`][mode], chapterToken[mode])
  return PIN_INKS.reduce((best, ink) => (ratio(ink) > ratio(best) ? ink : best))
}

function paletteTs() {
  const themeObjects = themes.map(({ mode, name }) => {
    const entries = semantic.map(([key, t]) => `${JSON.stringify(key)}: ${JSON.stringify(t[mode])}`)
    return `${name}: { ${entries.join(', ')} }`
  })
  const layoutEntries = layout.map(
    ([key, t]) =>
      `${JSON.stringify(key)}: { css: ${JSON.stringify(t.css)}, value: ${JSON.stringify(layoutValue(t))} }`,
  )
  return [
    `// ${HEADER}`,
    `export const palette = { ${themeObjects.join(', ')} } as const`,
    `export const layout = { ${layoutEntries.join(', ')} } as const`,
    `export type ThemeName = ${themes.map(({ name }) => JSON.stringify(name)).join(' | ')}`,
    'export type SemanticToken = keyof typeof palette.day',
    '',
  ].join('\n')
}

function tokensCss() {
  const rootDecls = [
    ...layout.map(([, t]) => `${t.css}: ${layoutValue(t)};`),
    ...effects.map(([, t]) => `${t.css}: ${t.value};`),
  ]
  const blocks = [`:root { ${rootDecls.join(' ')} }`]
  for (const { mode, name } of themes) {
    const decls = semantic.map(([, t]) => `${t.css}: ${t[mode]};`)
    blocks.push(`:root[data-theme="${name}"] { ${decls.join(' ')} }`)
  }
  return [`/* ${HEADER} */`, ...blocks, ''].join('\n')
}

function pinInkTs() {
  const themeObjects = themes.map(({ mode, name }) => {
    const entries = chapters.map(({ id, token }) => `${id}: ${JSON.stringify(pinInk(mode, token))}`)
    return `${name}: { ${entries.join(', ')} }`
  })
  return [
    `// ${HEADER}`,
    '// Текстовый токен номера на пине/метке главы (text/<ink>), контрастнее на цвете главы.',
    `export const PIN_INK = { ${themeObjects.join(', ')} } as const`,
    'export type PinChapter = keyof typeof PIN_INK.day',
    '',
  ].join('\n')
}

function pinsCss() {
  const blocks = themes.map(({ mode, name }) => {
    const decls = chapters.map(
      ({ id, token }) => `--pin-ink-${id}: var(--text-${pinInk(mode, token)});`,
    )
    return `:root[data-theme="${name}"] { ${decls.join(' ')} }`
  })
  return [`/* ${HEADER} */`, ...blocks, ''].join('\n')
}

async function emit(relativePath, source, parser) {
  const url = new URL(relativePath, root)
  const config = await resolveConfig(fileURLToPath(url))
  await writeFile(url, await format(source, { ...config, parser }))
  console.log(`gen-theme: wrote ${relativePath}`)
}

await emit('src/theme/palette.ts', paletteTs(), 'typescript')
await emit('src/theme/tokens.css', tokensCss(), 'css')
await emit('src/theme/pinInk.ts', pinInkTs(), 'typescript')
await emit('src/theme/pins.css', pinsCss(), 'css')
