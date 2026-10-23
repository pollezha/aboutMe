// Скриншоты первого экрана для сверки с Figma: сборка → vite preview → headless Chrome (scripts/cdp.mjs).
// Результат: docs/design/shots/<w>x<h>-<theme>[-ru].png. Chrome: env CHROME_PATH или стандартные пути.
// Размер вьюпорта задаётся через DevTools Protocol (Emulation.setDeviceMetricsOverride): окно Chrome
// не бывает уже ~500 px, поэтому `--window-size=390,…` дал бы неверную раскладку телефона.
// Планшет и телефон снимаются в 2D (`?mode=2d`): их кадры в Figma — 2D-карта (урок этапа 2).
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { preview } from 'vite'
import { launchChrome } from './cdp.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, '../docs/design/shots')
const previewPort = 4173
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
/** До этой ширины включительно кадр — 2D-карта. */
const MAX_2D_WIDTH = 768

async function shoot(browser, width, height, theme, lang = 'en') {
  await browser.withPage(async (page) => {
    await page.setViewport({ width, height, mobile: width < 768 })
    // Язык страницы задаёт маршрут: `/` — EN, `/ru/` — RU (предрендер vite-ssg).
    const path = lang === 'ru' ? '/ru/' : '/'
    const query = new URLSearchParams({ theme })
    if (width <= MAX_2D_WIDTH) query.set('mode', '2d')
    await page.navigate(`http://localhost:${previewPort}${path}?${query}`)
    await delay(SETTLE_MS)
    const suffix = lang === 'en' ? '' : `-${lang}`
    const file = join(outDir, `${width}x${height}-${theme}${suffix}.png`)
    writeFileSync(file, await page.screenshot())
    console.log(`shot ${file}`)
  })
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

try {
  // Язык браузера — английский: иначе boot-скрипт по navigator.language (RU-система) уводит `/` на `/ru/`.
  const browser = await launchChrome({
    prefix: 'aboutme-shots-',
    args: ['--lang=en-US', '--accept-lang=en-US'],
  })
  try {
    for (const [width, height] of SIZES) {
      for (const theme of THEMES) await shoot(browser, width, height, theme)
    }
    for (const [width, height, theme] of RU_SHOTS) await shoot(browser, width, height, theme, 'ru')
  } finally {
    await browser.close()
  }
} finally {
  await server.close()
}
