// Скриншоты первого экрана для сверки с Figma: сборка → vite preview → headless Chrome.
// Результат: docs/design/shots/<w>x<h>-<theme>[-ru].png. Chrome: env CHROME_PATH или стандартный путь Windows.
// Размер вьюпорта задаётся через DevTools Protocol (Emulation.setDeviceMetricsOverride): окно Chrome
// не бывает уже ~500 px, поэтому `--window-size=390,…` дал бы неверную раскладку телефона.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { preview } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, '../docs/design/shots')
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const previewPort = 4173
const debugPort = 9333
const SETTLE_MS = 1500

const SIZES = [
  [1440, 900],
  [1280, 720],
  [768, 1024],
  [390, 844],
]
const THEMES = ['day', 'night']
// RU-кадры для проверки кириллицы (Onest) рядом с латиницей (Bricolage).
const RU_SHOTS = [
  [1440, 900, 'day'],
  [390, 844, 'day'],
]

/** Минимальный CDP-клиент поверх встроенного WebSocket (Node ≥ 22). */
async function connect(wsUrl) {
  const socket = new WebSocket(wsUrl)
  await new Promise((ok, fail) => {
    socket.addEventListener('open', ok, { once: true })
    socket.addEventListener('error', fail, { once: true })
  })
  let nextId = 0
  const pending = new Map()
  const waiters = []
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (message.id !== undefined) {
      const call = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) call?.fail(new Error(message.error.message))
      else call?.ok(message.result)
    } else {
      for (const waiter of waiters.filter((w) => w.method === message.method)) {
        waiters.splice(waiters.indexOf(waiter), 1)
        waiter.ok(message.params)
      }
    }
  })
  return {
    send(method, params = {}) {
      const id = ++nextId
      socket.send(JSON.stringify({ id, method, params }))
      return new Promise((ok, fail) => pending.set(id, { ok, fail }))
    },
    once(method) {
      return new Promise((ok) => waiters.push({ method, ok }))
    },
    close() {
      socket.close()
    },
  }
}

async function waitForDebugger() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`)
      if (response.ok) return
    } catch {
      /* Chrome ещё стартует */
    }
    await delay(200)
  }
  throw new Error('Chrome DevTools endpoint did not come up')
}

async function shoot(width, height, theme, lang = 'en') {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, {
    method: 'PUT',
  })
  const target = await response.json()
  const page = await connect(target.webSocketDebuggerUrl)
  try {
    await page.send('Page.enable')
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    })
    // Язык страницы задаёт маршрут: `/` — EN, `/ru/` — RU (предрендер vite-ssg).
    const path = lang === 'ru' ? '/ru/' : '/'
    const loaded = page.once('Page.loadEventFired')
    await page.send('Page.navigate', {
      url: `http://localhost:${previewPort}${path}?theme=${theme}`,
    })
    await loaded
    await delay(SETTLE_MS)
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' })
    const suffix = lang === 'en' ? '' : `-${lang}`
    const file = join(outDir, `${width}x${height}-${theme}${suffix}.png`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    console.log(`shot ${file}`)
  } finally {
    page.close()
    await fetch(`http://127.0.0.1:${debugPort}/json/close/${target.id}`)
  }
}

if (!existsSync(chrome)) {
  console.error(`Chrome not found at ${chrome}; set CHROME_PATH`)
  process.exit(1)
}

if (!process.argv.includes('--no-build')) {
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: true })
}

mkdirSync(outDir, { recursive: true })
const server = await preview({
  root,
  preview: { port: previewPort, strictPort: true },
  logLevel: 'warn',
})
// Свой временный профиль: профиль пользователя не трогаем, localStorage пустой.
const profile = mkdtempSync(join(tmpdir(), 'aboutme-shots-'))
const browser = spawn(
  chrome,
  [
    '--headless=new',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${debugPort}`,
    '--no-first-run',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

try {
  await waitForDebugger()
  for (const [width, height] of SIZES) {
    for (const theme of THEMES) await shoot(width, height, theme)
  }
  for (const [width, height, theme] of RU_SHOTS) await shoot(width, height, theme, 'ru')
} finally {
  browser.kill()
  await server.close()
  await delay(500)
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
