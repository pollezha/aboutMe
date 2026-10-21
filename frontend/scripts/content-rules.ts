import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js'

// Проверка публикуемого контента (FR9, AC7): схема + запрет заглушек.
// Модуль без доступа к файлам — его используют тесты и CLI validate-content.mjs.

export interface ContentIssue {
  /** JSON Pointer поля, например `/profile/links/0/href` */
  path: string
  message: string
}

const PLACEHOLDER = '[ADD]'

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

export function validateContent(content: unknown, schema: object): ContentIssue[] {
  return [...schemaIssues(content, schema), ...placeholderIssues(content, '')]
}

function schemaIssues(content: unknown, schema: object): ContentIssue[] {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const validate = ajv.compile(schema)
  if (validate(content)) return []
  return (validate.errors ?? []).map(toIssue)
}

function toIssue(error: ErrorObject): ContentIssue {
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
  if (typeof value === 'string') {
    if (value.includes(PLACEHOLDER)) {
      return [{ path, message: `placeholder ${PLACEHOLDER} is not allowed in published content` }]
    }
    if (path.endsWith('/href') && (value.trim() === '' || value.trim() === '#')) {
      return [{ path, message: 'empty or "#" link is not allowed in published content' }]
    }
    return []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => placeholderIssues(item, `${path}/${index}`))
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, item]) =>
      placeholderIssues(item, `${path}/${escapePointer(key)}`),
    )
  }
  return []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function escapePointer(key: string): string {
  return key.replaceAll('~', '~0').replaceAll('/', '~1')
}
