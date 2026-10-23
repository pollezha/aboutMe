// «3D интерактивна < 4 с» (NFR1, T2 спеки): время метки `scene_ready` (performance.mark в App.vue) на `/`
// десктопа 1280×720 под троттлингом Lighthouse «Slow 4G» и CPU 4×. Lighthouse эту метку не ассертит, поэтому
// отдельный замер: dist/ раздаётся своим сервером с gzip (как CDN), headless Chrome через scripts/cdp.mjs.
// Запуск: `npm run build && npm run perf:scene` (`--runs N`, по умолчанию 3); вердикт — по медиане.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createGzip } from 'node:zlib'

export const SCENE_READY_BUDGET_MS = 4000

/** Медиана прогонов и вердикт; прогон без метки (null) — провал. */
export function verdict(runs, budget = SCENE_READY_BUDGET_MS) {
  if (runs.length === 0 || runs.some((run) => run === null)) return { median: null, passed: false }
  const sorted = [...runs].sort((a, b) => a - b)
  const median = sorted[Math.floor((sorted.length - 1) / 2)]
  return { median, passed: median <= budget }
}

// Lighthouse mobileSlow4G в режиме devtools (throttling.js): RTT 150 мс × 3,75, 1,6 Мбит/с вниз.
const NETWORK = {
  offline: false,
  latency: 562.5,
  downloadThroughput: (1474.56 * 1024) / 8,
  uploadThroughput: (675 * 1024) / 8,
}
const CPU_SLOWDOWN = 4
const VIEWPORT = { width: 1280, height: 720 }
/** Дольше ждать нет смысла: через 8 с App сам уходит в 2D (SCENE_TIMEOUT_MS). */
const WAIT_MS = 15_000

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
}
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg'])

/** Статика dist/ на 127.0.0.1:<свободный порт>; `/ru/` → ru/index.html; текст — gzip. */
function serve(dist) {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://local').pathname)
    let file = normalize(join(dist, path))
    if (!file.startsWith(dist)) return response.writeHead(403).end()
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) return response.writeHead(404).end()
    const ext = extname(file)
    const headers = { 'Content-Type': TYPES[ext] ?? 'application/octet-stream' }
    const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(request.headers['accept-encoding'] ?? '')
    if (gzip) headers['Content-Encoding'] = 'gzip'
    response.writeHead(200, headers)
    const body = createReadStream(file)
    ;(gzip ? body.pipe(createGzip()) : body).pipe(response)
  })
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)))
}

async function measure(page, url) {
  await page.send('Network.enable')
  await page.send('Network.setCacheDisabled', { cacheDisabled: true })
  // Скрипт, который антивирус (Kaspersky) встраивает в страницы на машине разработчика, — шум; в CI его нет.
  await page.send('Network.setBlockedURLs', { urls: ['*.kaspersky-labs.com*'] })
  await page.send('Network.emulateNetworkConditions', NETWORK)
  await page.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN })
  await page.setViewport(VIEWPORT)
  await page.navigate(url)
  const started = Date.now()
  while (Date.now() - started < WAIT_MS) {
    const mark = await page.evaluate(
      "performance.getEntriesByName('scene_ready', 'mark')[0]?.startTime ?? null",
    )
    if (mark !== null) return Math.round(mark)
    await delay(200)
  }
  return null
}

async function main() {
  const { launchChrome } = await import('./cdp.mjs')
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const dist = resolve(root, 'dist')
  if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/ not found: run `npm run build`')
  const runsArg = process.argv.indexOf('--runs')
  const runCount = runsArg > 0 ? Number(process.argv[runsArg + 1]) : 3

  const server = await serve(dist)
  const url = `http://127.0.0.1:${server.address().port}/`
  // Язык браузера — английский: иначе boot-скрипт на RU-системе уводит `/` на `/ru/`.
  const browser = await launchChrome({
    prefix: 'aboutme-scene-',
    windowSize: [VIEWPORT.width, VIEWPORT.height],
    args: ['--lang=en-US', '--accept-lang=en-US'],
  })
  const runs = []
  try {
    for (let run = 1; run <= runCount; run++) {
      const time = await browser.withPage((page) => measure(page, url))
      console.log(`run ${run}: scene_ready ${time === null ? 'not reached' : `${time} ms`}`)
      runs.push(time)
    }
  } finally {
    await browser.close()
    server.close()
  }
  const { median, passed } = verdict(runs)
  const summary = `scene_ready median ${median ?? '—'} ms (budget ${SCENE_READY_BUDGET_MS} ms)`
  console.log(passed ? `ok: ${summary}` : `FAIL: ${summary}`)
  if (!passed) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
