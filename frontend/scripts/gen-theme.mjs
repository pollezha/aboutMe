// Генерирует src/theme/palette.ts и src/theme/tokens.css из снимка Figma scripts/design/figma-tokens.json.
// Детерминирован: порядок ключей = порядок в JSON, вывод прогоняется через Prettier проекта,
// поэтому повторный запуск не меняет файлы (CI: `npm run gen:theme && git diff --exit-code`).
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

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

async function emit(relativePath, source, parser) {
  const url = new URL(relativePath, root)
  const config = await resolveConfig(fileURLToPath(url))
  await writeFile(url, await format(source, { ...config, parser }))
  console.log(`gen-theme: wrote ${relativePath}`)
}

await emit('src/theme/palette.ts', paletteTs(), 'typescript')
await emit('src/theme/tokens.css', tokensCss(), 'css')
