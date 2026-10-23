// Общий headless Chrome для скриптов сборки (shots, og, cv, island): поиск браузера, запуск со своим
// временным профилем, минимальный клиент DevTools Protocol поверх встроенного WebSocket (Node ≥ 22).
// Порт отладки выбирает сам Chrome (--remote-debugging-port=0) и пишет его в DevToolsActivePort профиля —
// параллельные скрипты не конфликтуют.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

/** Стандартные пути установки по платформам; LOCALAPPDATA — установка Chrome «только для меня». */
function candidates(env, platform) {
  if (platform === 'win32') {
    return [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      env.LOCALAPPDATA &&
        `${env.LOCALAPPDATA.replaceAll('\\', '/')}/Google/Chrome/Application/chrome.exe`,
    ].filter(Boolean)
  }
  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ]
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
}

/**
 * Путь к Chrome: CHROME_PATH (если задан — только он, без молчаливой подмены другим браузером),
 * иначе первый существующий стандартный путь; null — не найден.
 */
export function findChrome({
  env = process.env,
  platform = process.platform,
  exists = existsSync,
} = {}) {
  if (env.CHROME_PATH) return exists(env.CHROME_PATH) ? env.CHROME_PATH : null
  return candidates(env, platform).find((path) => exists(path)) ?? null
}

/** Минимальный CDP-клиент: send(method, params) → result, once(event) → params. */
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

async function waitForPort(profile) {
  const file = join(profile, 'DevToolsActivePort')
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const port = Number(readFileSync(file, 'utf8').split('\n')[0])
      if (port > 0) {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`)
        if (response.ok) return port
      }
    } catch {
      /* Chrome ещё стартует */
    }
    await delay(100)
  }
  throw new Error('Chrome DevTools endpoint did not come up')
}

/** Вкладка: обёртки над частыми вызовами CDP; `send` — для остального. */
function pageApi(client) {
  const page = {
    send: client.send,
    once: client.once,
    /** Вьюпорт через Emulation: окно Chrome не бывает уже ~500 px, --window-size телефон не даст. */
    setViewport({ width, height, deviceScaleFactor = 1, mobile = false }) {
      return client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor,
        mobile,
      })
    },
    /** prefers-color-scheme, prefers-reduced-motion и т. п.: [{ name, value }]; media — 'print'/'screen'. */
    emulateMedia({ media = '', features = [] } = {}) {
      return client.send('Emulation.setEmulatedMedia', { media, features })
    },
    /** Переход и ожидание load. */
    async navigate(url) {
      await client.send('Page.enable')
      const loaded = client.once('Page.loadEventFired')
      const { errorText } = await client.send('Page.navigate', { url })
      if (errorText) throw new Error(`navigate ${url}: ${errorText}`)
      await loaded
    },
    /** HTML-строка вместо документа (шаблоны og/cv). */
    async setContent(html) {
      const { frameTree } = await client.send('Page.getFrameTree')
      await client.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html })
    },
    async evaluate(expression) {
      const { result, exceptionDetails } = await client.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
      if (exceptionDetails)
        throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
      return result.value
    },
    /** Page.captureScreenshot → Buffer; format png|jpeg|webp, quality для jpeg/webp, clip в CSS px. */
    async screenshot(options = {}) {
      const { data } = await client.send('Page.captureScreenshot', { format: 'png', ...options })
      return Buffer.from(data, 'base64')
    },
    async pdf(options = {}) {
      const { data } = await client.send('Page.printToPDF', options)
      return Buffer.from(data, 'base64')
    },
  }
  return page
}

/**
 * Запускает headless Chrome со своим временным профилем (профиль пользователя не трогаем, localStorage пуст).
 * Возвращает { newPage(), withPage(work), close() }. Бросает, если Chrome не найден.
 */
export async function launchChrome({
  windowSize = [1280, 800],
  args = [],
  prefix = 'aboutme-',
} = {}) {
  const chrome = findChrome()
  if (!chrome) throw new Error('Chrome not found; set CHROME_PATH')
  const profile = mkdtempSync(join(tmpdir(), prefix))
  const browser = spawn(
    chrome,
    [
      '--headless=new',
      `--user-data-dir=${profile}`,
      '--remote-debugging-port=0',
      `--window-size=${windowSize.join(',')}`,
      '--no-first-run',
      '--hide-scrollbars',
      ...args,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  async function close() {
    browser.kill()
    await delay(500)
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }

  let port
  try {
    port = await waitForPort(profile)
  } catch (error) {
    await close()
    throw error
  }

  async function newPage() {
    const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
    const target = await response.json()
    const client = await connect(target.webSocketDebuggerUrl)
    const page = pageApi(client)
    page.close = async () => {
      client.close()
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`)
    }
    return page
  }

  async function withPage(work) {
    const page = await newPage()
    try {
      return await work(page)
    } finally {
      await page.close()
    }
  }

  return { newPage, withPage, close }
}
