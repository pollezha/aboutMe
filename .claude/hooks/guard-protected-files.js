// Логика хука guard-protected-files. Читает JSON вызова инструмента из stdin.
// exit 2 = заблокировать (сообщение в stderr уходит агенту), exit 0 = пропустить.
// Это защита от случайностей агента, не security boundary (см. CLAUDE.md).
// Тесты: node .claude/hooks/guard-protected-files.test.js
'use strict'

const PROTECTED = [
  /(^|\/)\.env($|\.)(?!example$)/i, // .env, .env.local — но не .env.example
  /(^|\/)secrets\//i,
  /\.(pem|key|pfx)$/i,
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|packages\.lock\.json)$/i,
  /(^|\/)\.github\/workflows(\/|$)/i,
]
const SECRET = [/(^|\/)\.env($|\.)(?!example$)/i, /(^|\/)secrets\//i, /\.(pem|key|pfx)$/i]

const WRITE_CMDS =
  /^(cp|mv|rm|del|tee|sed|copy-item|move-item|remove-item|set-content|add-content|out-file|new-item)$/i
const READ_CMDS =
  /^(cat|type|less|more|head|tail|grep|egrep|rg|awk|strings|od|xxd|findstr|get-content|gc|select-string|sls|source|\.)$/i

const toPosix = (s) => s.replace(/\\/g, '/')
const isProtected = (p) => PROTECTED.some((re) => re.test(p))
const isSecret = (p) => SECRET.some((re) => re.test(p))

// Вырезает тела heredoc (<<TAG … TAG): их содержимое — данные, а не команды.
function stripHeredocs(command) {
  const out = []
  let tag = null
  for (const line of command.split(/\r?\n/)) {
    if (tag !== null) {
      if (line.trim() === tag) tag = null
      continue
    }
    const m = line.match(/<<-?\s*["']?([A-Za-z_][A-Za-z0-9_]*)["']?/)
    if (m) tag = m[1]
    out.push(line)
  }
  return out.join(' ')
}

// Делит команду на сегменты по | ; && || только вне кавычек.
function splitSegments(text) {
  const segs = []
  let cur = ''
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      cur += c
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      cur += c
      continue
    }
    const pair = text.slice(i, i + 2)
    if (pair === '&&' || pair === '||') {
      segs.push(cur)
      cur = ''
      i++
      continue
    }
    if (c === '|' || c === ';') {
      segs.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  segs.push(cur)
  return segs.map((s) => s.trim()).filter(Boolean)
}

// Сегмент → слова; кавычки снимаются, обратные слэши → прямые.
function words(segment) {
  return (segment.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((w) =>
    toPosix(w.replace(/^["']|["']$/g, '')),
  )
}

// Возвращает путь защищённого файла, который команда меняет или читает как секрет, либо null.
function findViolation(command) {
  for (const seg of splitSegments(stripHeredocs(command))) {
    const ws = words(seg)
    const cmd = (ws[0] || '').replace(/^.*\//, '')
    const sedInPlace = /^sed$/i.test(cmd) && ws.some((w) => /^-[a-z]*i/i.test(w))

    // Перенаправления вывода: > f, >> f, >f, 2>f, &>f
    for (let i = 1; i < ws.length; i++) {
      const w = ws[i]
      const target = /^[0-9&]?>>?$/.test(w) ? ws[i + 1] : (w.match(/^[0-9&]?>>?([^>].*)$/) || [])[1]
      if (target && isProtected(target)) return target
    }

    const writes = WRITE_CMDS.test(cmd) && (!/^sed$/i.test(cmd) || sedInPlace)
    const reads = READ_CMDS.test(cmd)
    if (!writes && !reads) continue
    for (const w of ws.slice(1)) {
      if (w.startsWith('-')) continue
      if (writes && isProtected(w)) return w
      if (reads && isSecret(w)) return w
    }
  }
  return null
}

// Возвращает путь-нарушитель для вызова инструмента или null.
function check(call) {
  const t = call.tool_input || {}
  if (call.tool_name === 'Bash' || call.tool_name === 'PowerShell') {
    return typeof t.command === 'string' ? findViolation(t.command) : null
  }
  const file = t.file_path || t.path || t.notebook_path
  return typeof file === 'string' && isProtected(toPosix(file)) ? file : null
}

module.exports = { check, findViolation }

if (require.main === module) {
  let input = ''
  process.stdin.on('data', (d) => (input += d)).on('end', () => {
    let call
    try {
      call = JSON.parse(input)
    } catch {
      process.exit(0)
    }
    const hit = check(call)
    if (hit) {
      process.stderr.write(
        `Файл '${hit}' защищён (секреты / lock-файлы / CI). Спроси пользователя, прежде чем менять его, или попроси выполнить изменение вручную.\n`,
      )
      process.exit(2)
    }
    process.exit(0)
  })
}
