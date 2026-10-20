import Ajv2020 from 'ajv/dist/2020.js'

// Проверка публикуемого контента (FR9, AC7): схема + запрет заглушек.
// Модуль без доступа к файлам — его используют тесты и CLI validate-content.mjs.

export interface ContentIssue {
  /** JSON Pointer поля, например `/profile/links/0/href` */
  path: string
  message: string
}

const PLACEHOLDER = '[ADD]'

export function validateContent(content: unknown, schema: object): ContentIssue[] {
  return [...schemaIssues(content, schema), ...placeholderIssues(content, '')]
}

function schemaIssues(content: unknown, schema: object): ContentIssue[] {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const validate = ajv.compile(schema)
  if (validate(content)) return []
  return (validate.errors ?? []).map((error) => ({
    path: error.instancePath || '/',
    message: error.message ?? 'is invalid',
  }))
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
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      placeholderIssues(item, `${path}/${escapePointer(key)}`),
    )
  }
  return []
}

function escapePointer(key: string): string {
  return key.replaceAll('~', '~0').replaceAll('/', '~1')
}
