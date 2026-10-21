// Запускается перед `npm run build` (prebuild): сборка падает, если контент не проходит проверку (AC7).
// Node 24 импортирует .ts напрямую (type stripping), поэтому отдельный раннер не нужен.
import { readFile, readdir } from 'node:fs/promises'
import process from 'node:process'
import { validateContentFile } from './content-rules.ts'

const contentDir = new URL('../../content/', import.meta.url)
const schema = JSON.parse(await readFile(new URL('schema/content.schema.json', contentDir), 'utf8'))

const files = (await readdir(contentDir)).filter((name) => name.endsWith('.json')).sort()
if (files.length === 0) {
  console.error('Content validation failed: no content/*.json files found.')
  process.exit(1)
}

let failed = false
for (const file of files) {
  const issues = validateContentFile(
    file,
    await readFile(new URL(file, contentDir), 'utf8'),
    schema,
  )
  for (const issue of issues) {
    const detail = issue.message.startsWith('invalid JSON')
      ? issue.message
      : `${issue.path} — ${issue.message}`
    console.error(`content/${file}: ${detail}`)
  }
  failed ||= issues.length > 0
}

if (failed) {
  console.error('Content validation failed: fix the fields above before publishing.')
  process.exit(1)
}
console.log(`Content OK: ${files.map((file) => `content/${file}`).join(', ')}`)
