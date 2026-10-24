// Граф модулей фронта (ADR-0007) — единственный источник истины для границ: eslint.config.js строит из него
// записи boundary(), тест scripts/__tests__/layer-boundaries.spec.ts проверяет ацикличность и регистрацию папок.
// Модуль = папка src/<module>/ с публичным index.ts; чужой модуль импортируется только как `../<module>`.
// Импорты в src относительные, поэтому модуль узнаём по префиксу «./» или «../»: `../shared/ui` — shared/ui, а не ui.

const shared = ['shared/lib', 'shared/ui']

/**
 * deps — стрелки ADR-0007 (таблица в frontend/CLAUDE.md сверяется с ними тестом);
 * facade — у модуля есть index.ts, глубокий импорт снаружи запрещён;
 * files — запись не папка-модуль, а набор файлов (корень src/*.ts); deepAllow — исключения из фасада
 *   ({ модуль: regex хвоста пути }); lazy — модуль грузится лениво; prerendered — без import().
 */
export const MODULES = {
  'shared/lib': { deps: [], facade: true },
  'shared/ui': { deps: ['shared/lib'], facade: true },
  content: { deps: [], facade: true },
  theme: { deps: ['shared/lib'], facade: true },
  locale: { deps: ['content', 'shared/lib'], facade: true },
  route: { deps: ['content', 'locale', ...shared], facade: true },
  hero: { deps: ['content', 'locale', ...shared], facade: true },
  chapters: {
    deps: ['content', 'locale', 'route', ...shared],
    facade: true,
    prerendered: true,
  },
  windows: {
    deps: ['chapters', 'content', 'locale', 'route', ...shared],
    facade: true,
    prerendered: true,
  },
  fallback2d: { deps: ['content', 'locale', 'theme', ...shared], facade: true },
  scene: {
    deps: ['content', 'locale', 'route', 'theme', 'shared/lib'],
    facade: true,
    lazy: true,
  },
  mode: { deps: ['scene', 'locale', ...shared], facade: true },
  app: {
    deps: [
      ...shared,
      'content',
      'theme',
      'locale',
      'route',
      'hero',
      'chapters',
      'windows',
      'fallback2d',
      'mode',
    ],
    facade: true,
  },

  // Корень (main.ts, env.d.ts) — вход vite-ssg в главном чанке: модули видит как `./M`; оболочка — ./app,
  // i18n и маршруты — ./locale. Его самого никто не импортирует, поэтому фасад — формальность.
  '.': {
    deps: ['app', 'locale', 'theme'],
    facade: true,
    files: ['src/*.ts'],
    // main.ts подключает глобальные стили темы: CSS через index.ts не реэкспортируется.
    deepAllow: { theme: '[^/]+\\.css$' },
  },
}

// Из папки модуля другой модуль достижим только через «../»: `./chapters` в content — свой файл.
// Корень (запись с files) лежит в src/ и видит модули как `./M`.
function modulePath(name, fromRoot) {
  return `^${fromRoot ? '(\\.\\.?/)+' : '(\\.\\./)+'}${name}(/|$)`
}

const THREE = '^(three|@tresjs/[^/]+)(/|$)'
const NO_3D = [THREE, 'three.js и TresJS — только в src/scene (чанк сцены грузится лениво).']

const ban = ([regex, message]) => ({ regex, message })

/**
 * Одна запись конфигурации на модуль: опции правила из разных записей не сливаются (побеждает последняя),
 * поэтому полный список запретов модуля собирается здесь. import() no-restricted-imports не видит — его ловит
 * no-restricted-syntax.
 */
function boundary(files, bans, syntax, ignores = []) {
  return {
    files,
    ignores: ['src/**/__tests__/**', ...ignores],
    rules: {
      'no-restricted-imports': ['error', { patterns: bans.map(ban) }],
      ...(syntax.length > 0 && { 'no-restricted-syntax': ['error', ...syntax] }),
    },
  }
}

const isFolderModule = (spec) => !spec.files

/** Запрет import() ленивых модулей и three/TresJS вне их index.ts. */
function lazySyntax(modules) {
  return [
    {
      selector: 'ImportExpression[source.value=/^(three|@tresjs)/]',
      message: 'Динамический импорт three.js/TresJS — только из src/scene/index.ts.',
    },
    ...Object.entries(modules)
      .filter(([, spec]) => spec.lazy)
      .map(([name]) => ({
        selector: `ImportExpression[source.value=/^[.][.]?[/]([.][.][/])*${name.replaceAll('/', '[/]')}([/]|$)/]`,
        message: `Модуль ${name} лениво грузит только src/${name}/index.ts.`,
      })),
  ]
}

/** Запреты модуля, выведенные из графа: стрелки вне графа и глубокие импорты в модули с фасадом. */
function graphBans(name, spec, modules) {
  const allowed = new Set(spec.deps)
  const [group] = name.split('/')
  const bans = []
  for (const [other, otherSpec] of Object.entries(modules)) {
    if (other === name || !isFolderModule(otherSpec)) continue
    // Соседа по группе (shared/ui ↔ shared/lib) можно назвать и коротко: `../lib`.
    const sibling = other.startsWith(`${group}/`) && name.startsWith(`${group}/`)
    const forms = [
      modulePath(other, !isFolderModule(spec)),
      ...(sibling ? [`^\\.\\./${other.slice(group.length + 1)}`] : []),
    ]
    const allow = spec.deepAllow?.[other]
    for (const form of forms) {
      const prefix = form.replace(/\(\/\|\$\)$/, '')
      if (!allowed.has(other)) {
        bans.push([`${prefix}(/|$)`, `Модуль ${other} отсюда недоступен (граф ADR-0007).`])
      } else if (otherSpec.facade) {
        bans.push([
          `${prefix}/${allow ? `(?!${allow})` : ''}.+`,
          `Модуль ${other} — только через ${other}/index.ts.`,
        ])
      }
    }
  }
  return bans
}

export function moduleBoundaries(modules) {
  const syntax = lazySyntax(modules)
  return Object.entries(modules).flatMap(([name, spec]) => {
    const files = spec.files ?? [`src/${name}/**/*.{ts,vue}`]
    const bans = graphBans(name, spec, modules)
    const ownSyntax = spec.prerendered
      ? [
          {
            selector: 'ImportExpression',
            message: `Без import() в ${name}: окна в главном чанке и в предрендере.`,
          },
        ]
      : syntax
    if (!spec.lazy) return [boundary(files, [NO_3D, ...bans], ownSyntax)]
    // Ленивый модуль: внутри three разрешён; index.ts в главном чанке — без статических .vue и three.
    const index = `src/${name}/index.ts`
    return [
      boundary(files, bans, ownSyntax, [index]),
      boundary(
        [index],
        [NO_3D, ...bans, ['\\.vue$', `${index} в главном чанке: .vue — только через import().`]],
        [],
      ),
    ]
  })
}

export function findCycle(modules) {
  const state = new Map()
  const visit = (name, path) => {
    if (state.get(name) === 'done') return null
    if (state.get(name) === 'open') return [...path.slice(path.indexOf(name)), name]
    state.set(name, 'open')
    const spec = modules[name]
    for (const dep of spec?.deps ?? []) {
      const cycle = visit(dep, [...path, name])
      if (cycle) return cycle
    }
    state.set(name, 'done')
    return null
  }
  for (const name of Object.keys(modules)) {
    const cycle = visit(name, [])
    if (cycle) return cycle
  }
  return null
}

/** Папка-группа (shared) сама не модуль: её подпапки проверяются отдельно как `shared/<name>`. */
export function unregisteredFolders(modules, folders) {
  const keys = Object.keys(modules)
  return folders.filter(
    (folder) => !keys.includes(folder) && !keys.some((key) => key.startsWith(`${folder}/`)),
  )
}
