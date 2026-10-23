// OG-превью 1200×630 и PNG-иконки 192/512 (FR11, D12): HTML-шаблон → headless Chrome → frontend/public/*.png.
// Цвета — palette.day, тексты — content/en.json, стаж — resolveHighlights (тот же код, что на первом экране).
// Шрифты встраиваются в шаблон data:-URL из node_modules (self-hosted, как на сайте; file:// из
// setDocumentContent не грузится). Объявлены только используемые начертания: скрипт падает, если какой-то
// @font-face не загрузился (неиспользуемый остаётся «unloaded»), — так превью не уйдёт на system-ui.
// Chrome и DevTools Protocol — scripts/cdp.mjs (CHROME_PATH или стандартные пути).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import en from '../../content/en.json' with { type: 'json' }
import { palette } from '../src/theme/palette.ts'
import { resolveHighlights } from '../src/content/experience.ts'
import { launchChrome } from './cdp.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = resolve(root, 'public')

const day = palette.day

function fontUrl(file) {
  const bytes = readFileSync(resolve(root, 'node_modules', file))
  return `data:font/woff2;base64,${bytes.toString('base64')}`
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function ogHtml() {
  const { profile } = en
  const metrics = resolveHighlights(en)
  const metricCards = metrics
    .map(
      (metric) => `
        <div class="metric">
          <div class="metric__label">${escapeHtml(metric.label)}</div>
          <div class="metric__value">${escapeHtml(metric.value)}</div>
          <div class="metric__note">${escapeHtml(metric.note)}</div>
        </div>`,
    )
    .join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
@font-face {
  font-family: 'Bricolage Grotesque Variable';
  font-weight: 200 800;
  src: url('${fontUrl('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2')}') format('woff2-variations');
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-weight: 700;
  src: url('${fontUrl('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2')}') format('woff2');
}
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
body {
  position: relative;
  background: ${day['scene/sky']};
  font-family: 'Bricolage Grotesque Variable', sans-serif;
  color: ${day['text/primary']};
}
.sea {
  position: absolute; right: -120px; bottom: -220px; width: 760px; height: 520px; border-radius: 50%;
  background: ${day['scene/sea']};
}
.sand {
  position: absolute; right: 40px; bottom: -40px; width: 460px; height: 300px; border-radius: 50%;
  background: ${day['scene/sand']};
}
.ground {
  position: absolute; right: 70px; bottom: -10px; width: 400px; height: 250px; border-radius: 50%;
  background: ${day['scene/ground']};
}
.road {
  position: absolute; right: 150px; bottom: 90px; width: 240px; height: 14px; border-radius: 7px;
  background: ${day['scene/road']}; transform: rotate(-18deg);
}
.pin {
  position: absolute; width: 44px; height: 44px; border-radius: 50%;
  border: 3px solid ${day['bg/surface']};
  font: 700 18px/38px 'IBM Plex Mono', monospace; text-align: center; color: ${day['text/on-dark']};
}
.card {
  position: absolute; left: 56px; top: 56px; width: 760px; padding: 44px 48px 40px;
  background: ${day['bg/surface']}; border-radius: 22px;
  border-top: 10px solid ${day['accent/primary']};
}
.status {
  display: inline-flex; align-items: center; gap: 10px; padding: 8px 16px; border-radius: 999px;
  background: ${day['bg/surface-alt']}; border: 1px solid ${day['border/default']};
  font-size: 20px; font-weight: 600; color: ${day['text/primary']};
}
.status::before {
  content: ''; width: 12px; height: 12px; border-radius: 50%; background: ${day['status/success']};
}
.name { margin-top: 20px; font-size: 68px; line-height: 1.05; font-weight: 800; letter-spacing: -0.01em; }
.role { margin-top: 8px; font-size: 34px; font-weight: 700; }
.where { margin-top: 10px; font-size: 20px; color: ${day['text/secondary']}; }
.metrics { margin-top: 28px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.metric {
  padding: 16px 18px; border-radius: 14px; background: ${day['bg/surface-alt']};
  border-left: 6px solid ${day['chapter/profile']};
}
.metric__label { font: 700 14px/1.3 'IBM Plex Mono', monospace; color: ${day['text/secondary']}; }
.metric__value { margin-top: 6px; font: 700 32px/1.1 'IBM Plex Mono', monospace; white-space: nowrap; }
.metric__note { margin-top: 6px; font-size: 16px; line-height: 1.3; color: ${day['text/secondary']}; }
</style></head><body>
  <div class="sea"></div><div class="sand"></div><div class="ground"></div><div class="road"></div>
  <div class="pin" style="right: 330px; bottom: 170px; background: ${day['chapter/profile']}">1</div>
  <div class="pin" style="right: 240px; bottom: 120px; background: ${day['chapter/timepath']}">3</div>
  <div class="pin" style="right: 150px; bottom: 200px; background: ${day['chapter/contact']}">6</div>
  <main class="card">
    <div class="status">${escapeHtml(profile.status)} · ${escapeHtml(profile.workFormat.toLowerCase())}</div>
    <h1 class="name">${escapeHtml(profile.name)}</h1>
    <p class="role">${escapeHtml(profile.role)}</p>
    <p class="where">${escapeHtml(profile.location)}</p>
    <div class="metrics">${metricCards}</div>
  </main>
</body></html>`
}

function iconHtml(size) {
  const svg = readFileSync(resolve(publicDir, 'favicon.svg'), 'utf8')
  return `<!doctype html><html><head><style>
* { margin: 0; } html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
svg { display: block; width: ${size}px; height: ${size}px; }
</style></head><body>${svg}</body></html>`
}

async function render(browser, html, width, height, file, { transparent = false } = {}) {
  await browser.withPage(async (page) => {
    await page.setViewport({ width, height })
    if (transparent) {
      await page.send('Emulation.setDefaultBackgroundColorOverride', {
        color: { r: 0, g: 0, b: 0, a: 0 },
      })
    }
    await page.setContent(html)
    const fonts = await page.evaluate(
      `document.fonts.ready.then(() => [...document.fonts].map((f) => f.family + ' ' + f.weight + ' ' + f.status))`,
    )
    const failed = fonts.filter((font) => !font.endsWith(' loaded'))
    if (failed.length > 0) throw new Error(`fonts not loaded in ${file}: ${failed.join(', ')}`)
    writeFileSync(file, await page.screenshot({ clip: { x: 0, y: 0, width, height, scale: 1 } }))
    console.log(`wrote ${file}${fonts.length ? ` (fonts: ${fonts.join('; ')})` : ''}`)
  })
}

const browser = await launchChrome({ prefix: 'aboutme-og-' })
try {
  await render(browser, ogHtml(), 1200, 630, join(publicDir, 'og.png'))
  for (const size of [192, 512]) {
    await render(browser, iconHtml(size), size, size, join(publicDir, `favicon-${size}.png`), {
      transparent: true,
    })
  }
} finally {
  await browser.close()
}
