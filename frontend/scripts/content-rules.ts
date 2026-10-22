import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js'

// Проверка публикуемого контента (FR9, AC7): схема, запрет заглушек, ссылки на experience[], токены дат.
// Модуль без доступа к файлам — его используют тесты и CLI validate-content.mjs.

export interface ContentIssue {
  /** JSON Pointer поля, например `/profile/links/0/href` */
  path: string
  message: string
}

const PLACEHOLDER = '[ADD]'
/** `[ADD]` и развёрнутая форма `[ADD: что дописать]`. */
const PLACEHOLDER_PATTERN = /\[ADD\b/

/** Токены дат в текстах глав; значения подставляет код из `experience[]`. */
const DATE_TOKENS = ['since', 'sinceShort', 'experience', 'period', 'span'] as const
const TOKEN_PATTERN = /\{([^{}]*)\}/g

/** Проверка одного файла `content/<lang>.json`: парсинг, схема, совпадение `lang` с именем файла. */
export function validateContentFile(
  fileName: string,
  text: string,
  schema: object,
): ContentIssue[] {
  let content: unknown
  try {
    content = JSON.parse(text)
  } catch (error) {
    return [{ path: '/', message: `invalid JSON — ${(error as Error).message}` }]
  }
  const issues = validateContent(content, schema)
  const expectedLang = fileName.replace(/\.json$/, '')
  const lang = isRecord(content) ? content.lang : undefined
  if (lang !== expectedLang) {
    issues.push({ path: '/lang', message: `must match file name "${expectedLang}"` })
  }
  return issues
}

export function validateContent(
  content: unknown,
  schema: object,
  now = new Date(),
): ContentIssue[] {
  return [
    ...schemaIssues(content, schema),
    ...placeholderIssues(content, ''),
    ...experienceIssues(content, now),
    ...experienceRefIssues(content),
    ...tokenIssues(content),
  ]
}

/** `chapters.*.experienceId` и `server.usedIn[]` ссылаются на существующие `experience[].id`. */
function experienceRefIssues(content: unknown): ContentIssue[] {
  if (!isRecord(content) || !Array.isArray(content.experience) || !isRecord(content.chapters)) {
    return []
  }
  const known = new Set(
    content.experience.flatMap((entry: unknown) => (isRecord(entry) ? [entry.id] : [])),
  )
  const unknownId = (id: unknown, path: string): ContentIssue[] =>
    typeof id === 'string' && !known.has(id)
      ? [{ path, message: `unknown experience id "${id}"` }]
      : []

  const chapterIssues = Object.entries(content.chapters).flatMap(([key, chapter]) =>
    isRecord(chapter) && 'experienceId' in chapter
      ? unknownId(chapter.experienceId, `/chapters/${escapePointer(key)}/experienceId`)
      : [],
  )
  const techstack = content.chapters.techstack
  const racks = isRecord(techstack) && Array.isArray(techstack.racks) ? techstack.racks : []
  const serverIssues = racks.flatMap((rack: unknown, r) => {
    const servers = isRecord(rack) && Array.isArray(rack.servers) ? rack.servers : []
    return servers.flatMap((server: unknown, s) => {
      const usedIn = isRecord(server) && Array.isArray(server.usedIn) ? server.usedIn : []
      return usedIn.flatMap((id: unknown, u) =>
        unknownId(id, `/chapters/techstack/racks/${r}/servers/${s}/usedIn/${u}`),
      )
    })
  })
  return [...chapterIssues, ...serverIssues]
}

/** Токены дат в текстах глав: только известные; {period} — только в главе с `experienceId`. */
function tokenIssues(content: unknown): ContentIssue[] {
  if (!isRecord(content) || !isRecord(content.chapters)) return []
  const allowed = DATE_TOKENS.map((token) => `{${token}}`).join(', ')
  return Object.entries(content.chapters).flatMap(([key, chapter]) => {
    const hasPeriod = isRecord(chapter) && typeof chapter.experienceId === 'string'
    return strings(chapter, `/chapters/${escapePointer(key)}`).flatMap(([path, text]) =>
      [...text.matchAll(TOKEN_PATTERN)].flatMap(([match, name]): ContentIssue[] => {
        if (!(DATE_TOKENS as readonly string[]).includes(name ?? '')) {
          return [{ path, message: `unknown token ${match}; allowed: ${allowed}` }]
        }
        if (name === 'period' && !hasPeriod) {
          return [{ path, message: '{period} needs experienceId on the chapter' }]
        }
        return []
      }),
    )
  })
}

/** Все строки значения с их JSON Pointer. */
function strings(value: unknown, path: string): [string, string][] {
  if (typeof value === 'string') return [[path, value]]
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, `${path}/${index}`))
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, item]) =>
      strings(item, `${path}/${escapePointer(key)}`),
    )
  }
  return []
}

const YEAR_MONTH = /^\d{4}-\d{2}$/

/** Периоды стажа (D21): `to` не раньше `from`, `from` не в будущем. `YYYY-MM` сравниваются как строки. */
function experienceIssues(content: unknown, now: Date): ContentIssue[] {
  if (!isRecord(content) || !Array.isArray(content.experience)) return []
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return content.experience.flatMap((entry: unknown, index) => {
    if (!isRecord(entry) || typeof entry.from !== 'string' || !YEAR_MONTH.test(entry.from)) {
      return []
    }
    const issues: ContentIssue[] = []
    if (entry.from > currentMonth) {
      issues.push({ path: `/experience/${index}/from`, message: 'must not be in the future' })
    }
    if (typeof entry.to === 'string' && YEAR_MONTH.test(entry.to) && entry.to < entry.from) {
      issues.push({ path: `/experience/${index}/to`, message: 'must not be earlier than from' })
    }
    return issues
  })
}

function schemaIssues(content: unknown, schema: object): ContentIssue[] {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const validate = ajv.compile(schema)
  if (validate(content)) return []
  // «must match "else" schema» дублирует ошибки выбранной ветки if/then/else
  return (validate.errors ?? []).filter((error) => error.keyword !== 'if').map(toIssue)
}

function toIssue(error: ErrorObject): ContentIssue {
  if (error.keyword === 'pattern' && error.instancePath.endsWith('/href')) {
    return {
      path: error.instancePath,
      message: 'must be an https:// URL, a mailto: address or a site path starting with "/"',
    }
  }
  if (error.keyword === 'additionalProperties') {
    const property = String(error.params.additionalProperty)
    return {
      path: `${error.instancePath}/${escapePointer(property)}`,
      message: `unknown property "${property}"`,
    }
  }
  const path = error.instancePath || '/'
  if (error.keyword === 'enum') {
    const allowed = (error.params.allowedValues as unknown[]).map(String).join(', ')
    return { path, message: `must be one of: ${allowed}` }
  }
  return { path, message: error.message ?? 'is invalid' }
}

function placeholderIssues(value: unknown, path: string): ContentIssue[] {
  return strings(value, path).flatMap(([at, text]): ContentIssue[] => {
    if (PLACEHOLDER_PATTERN.test(text)) {
      return [
        { path: at, message: `placeholder ${PLACEHOLDER} is not allowed in published content` },
      ]
    }
    if (at.endsWith('/href') && (text.trim() === '' || text.trim() === '#')) {
      return [{ path: at, message: 'empty or "#" link is not allowed in published content' }]
    }
    return []
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function escapePointer(key: string): string {
  return key.replaceAll('~', '~0').replaceAll('/', '~1')
}
