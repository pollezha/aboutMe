// Рендер острова для 2D-карты (FR10): сборка → vite preview → headless Chrome (scripts/cdp.mjs) открывает
// `/?mode=3d&theme=<t>&shot=island` — App показывает только сцену в кадре рендера (src/scene/framing.ts:
// остров по центру, поворот 0, без подписей и HTML-слоя) — и снимает вьюпорт в WebP прямо через CDP
// (Page.captureScreenshot format=webp): public/img/island-<theme>.webp 1200 px и @2x 2400 px.
// Бюджет 1x — 120 КБ (LCP 2D-режима); если не влезает, качество снижается ступенями.
// Хотспоты карты (figma-2d-map.json) сверяет с этим кадром тест src/scene/__tests__/framing.spec.ts.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { preview } from 'vite'
import { ISLAND_RENDER_HEIGHT, ISLAND_RENDER_WIDTH } from '../src/fallback2d/render.ts'
import { launchChrome } from './cdp.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public', 'img')
const previewPort = 4174
const THEMES = ['day', 'evening', 'night']
const BUDGET_1X = 120 * 1024
const QUALITIES = [82, 75, 68]
/** Сцена после scene_ready: пара кадров на тени и сглаживание. */
const SETTLE_MS = 800
const READY_TIMEOUT_MS = 20_000

/** Размер WebP из заголовка: VP8 (lossy), VP8L (lossless) или VP8X (расширенный). */
function webpSize(bytes) {
  const chunk = bytes.toString('ascii', 12, 16)
  if (chunk === 'VP8X') return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)]
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21)
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)]
  }
  return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff]
}

async function waitForScene(page) {
  const started = Date.now()
  while (Date.now() - started < READY_TIMEOUT_MS) {
    const state = await page.evaluate(
      `({ ready: performance.getEntriesByName('scene_ready').length > 0,
          mode: document.querySelector('.app')?.classList.contains('app--3d') ? '3d' : '2d' })`,
    )
    if (state.ready) return
    if (state.mode === '2d') throw new Error('page fell back to 2D: no WebGL2 in headless Chrome?')
    await delay(200)
  }
  throw new Error('scene_ready did not come')
}

/**
 * Кадр темы в масштабе scale; качество — первое из qualities, при котором 1x влезает в бюджет
 * (у @2x бюджета нет: его грузят только экраны с DPR 2, качество то же, что у 1x).
 */
async function render(browser, theme, scale, qualities) {
  return browser.withPage(async (page) => {
    await page.setViewport({
      width: ISLAND_RENDER_WIDTH,
      height: ISLAND_RENDER_HEIGHT,
      deviceScaleFactor: scale,
    })
    await page.emulateMedia({ features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await page.navigate(`http://localhost:${previewPort}/?mode=3d&theme=${theme}&shot=island`)
    await waitForScene(page)
    await delay(SETTLE_MS)
    let shot
    for (const quality of qualities) {
      shot = { quality, webp: await page.screenshot({ format: 'webp', quality }) }
      if (scale === 2 || shot.webp.length <= BUDGET_1X) break
    }
    return shot
  })
}

function save(file, { quality, webp }) {
  writeFileSync(join(outDir, file), webp)
  const [width, height] = webpSize(webp)
  console.log(
    `wrote ${file}: ${width}×${height}, q${quality}, ${(webp.length / 1024).toFixed(1)} KiB`,
  )
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

let overBudget = false
try {
  const browser = await launchChrome({ prefix: 'aboutme-island-' })
  try {
    for (const theme of THEMES) {
      const base = await render(browser, theme, 1, QUALITIES)
      if (base.webp.length > BUDGET_1X) overBudget = true
      save(`island-${theme}.webp`, base)
      save(`island-${theme}@2x.webp`, await render(browser, theme, 2, [base.quality]))
    }
  } finally {
    await browser.close()
  }
} finally {
  await server.close()
}

if (overBudget) {
  console.error(`island render over ${BUDGET_1X / 1024} KiB at the lowest quality`)
  process.exit(1)
}
