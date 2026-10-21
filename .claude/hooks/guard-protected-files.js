// Логика хука guard-protected-files. Читает JSON вызова инструмента из stdin.
// exit 2 = заблокировать (сообщение в stderr уходит агенту), exit 0 = пропустить.
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
const READ_CMDS = /^(cat|type|less|more|head|tail|get-content|gc|source|\.)$/i

function deny(path) {
  process.stderr.write(
    `Файл '${path}' защищён (секреты / lock-файлы / CI). Спроси пользователя, прежде чем менять его, или попроси выполнить изменение вручную.\n`,
  )
  process.exit(2)
}

const toPosix = (s) => s.replace(/\\/g, '/')
const isProtected = (p) => PROTECTED.some((re) => re.test(p))
const isSecret = (p) => SECRET.some((re) => re.test(p))

// Разбивает команду на сегменты по | ; && ||, каждый — на слова (кавычки снимаются).
function segments(command) {
  return command
    .replace(/\r?\n/g, ' ')
    .split(/\|\||&&|[|;]/)
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => seg.match(/"[^"]*"|'[^']*'|\S+/g) || [])
    .map((words) => words.map((w) => toPosix(w.replace(/^["']|["']$/g, ''))))
}

function checkCommand(command) {
  for (const words of segments(command)) {
    const cmd = (words[0] || '').replace(/^.*\//, '')
    const sedInPlace = /^sed$/i.test(cmd) && words.some((w) => /^-[a-z]*i/i.test(w))

    // Перенаправления вывода: > file, >> file, >file
    for (let i = 1; i < words.length; i++) {
      const w = words[i]
      const inline = w.match(/^>{1,2}(.+)$/)
      const target = inline ? inline[1] : /^>{1,2}$/.test(w) ? words[i + 1] : undefined
      if (target && isProtected(target)) deny(target)
    }

    const writes = WRITE_CMDS.test(cmd) && (!/^sed$/i.test(cmd) || sedInPlace)
    const reads = READ_CMDS.test(cmd)
    if (!writes && !reads) continue
    for (const w of words.slice(1)) {
      if (w.startsWith('-')) continue
      if (writes && isProtected(w)) deny(w)
      if (reads && isSecret(w)) deny(w)
    }
  }
}

let input = ''
process.stdin.on('data', (d) => (input += d)).on('end', () => {
  let call
  try {
    call = JSON.parse(input)
  } catch {
    process.exit(0)
  }
  const t = call.tool_input || {}
  if (call.tool_name === 'Bash' || call.tool_name === 'PowerShell') {
    if (typeof t.command === 'string') checkCommand(t.command)
    process.exit(0)
  }
  const file = t.file_path || t.path || t.notebook_path
  if (typeof file === 'string' && isProtected(toPosix(file))) deny(file)
  process.exit(0)
})
