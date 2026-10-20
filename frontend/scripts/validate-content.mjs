// Запускается перед `npm run build` (prebuild): сборка падает, если контент не проходит проверку (AC7).
// Node 24 импортирует .ts напрямую (type stripping), поэтому отдельный раннер не нужен.
import { readFile, readdir } from 'node:fs/promises'
import process from 'node:process'
import { validateContent } from './content-rules.ts'

const contentDir = new URL('../../content/', import.meta.url)
const schema = JSON.parse(await readFile(new URL('schema/content.schema.json', contentDir), 'utf8'))

const files = (await readdir(contentDir)).filter((name) => name.endsWith('.json')).sort()
let failed = false

for (const file of files) {
  const content = JSON.parse(await readFile(new URL(file, contentDir), 'utf8'))
  const issues = validateContent(content, schema)
  for (const issue of issues) {
    console.error(`content/${file}: ${issue.path} — ${issue.message}`)
  }
  failed ||= issues.length > 0
}

if (failed) {
  console.error('Content validation failed: fix the fields above before publishing.')
  process.exit(1)
}
console.log(`Content OK: ${files.map((file) => `content/${file}`).join(', ')}`)
