// Резюме EN/RU в PDF: HTML-шаблон → headless Chrome (Page.printToPDF) → frontend/public/cv/*.pdf.
// Тот же приём, что og.mjs: CDP поверх встроенного WebSocket, шрифты data:-URL из node_modules.
// Латиница — Bricolage Grotesque (на сайте), числа и даты — IBM Plex Mono (latin + cyrillic).
// Кириллицу Bricolage не содержит: для RU-текста Chrome поглифно откатывается на 'Segoe UI' (Windows);
// PDF встраивает использованные глифы, так что файл самодостаточен. Данные — scripts/cv-data.mjs.
// Переменная CV_PREVIEW_DIR — туда дополнительно снимаются PNG шаблона (794×N) для визуальной проверки.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { palette } from '../src/theme/palette.ts'
import { cvs } from './cv-data.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public', 'cv')
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const debugPort = 9335
const previewDir = process.env.CV_PREVIEW_DIR

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

const link = (item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`

function experienceHtml(cv, job) {
  const where = [job.company, job.place].filter(Boolean).map(escapeHtml).join(' · ')
  return `
    <article class="job">
      <div class="job__head">
        <div>
          <div class="job__title">${escapeHtml(job.title)}</div>
          <div class="job__where">${where}</div>
        </div>
        <div class="job__period">${escapeHtml(job.period)}</div>
      </div>
      <p class="job__intro">${escapeHtml(job.intro)}</p>
      <ul>${job.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
      <p class="job__stack"><span class="label">${escapeHtml(cv.labels.stack)}:</span> ${escapeHtml(job.stack)} · ${link(job.link)}</p>
    </article>`
}

function cvHtml(cv) {
  const { labels } = cv
  return `<!doctype html>
<html lang="${cv.lang}"><head><meta charset="utf-8"><title>${escapeHtml(cv.name)}</title><style>
@font-face {
  font-family: 'Bricolage Grotesque Variable';
  font-weight: 200 800;
  src: url('${fontUrl('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2')}') format('woff2-variations');
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-weight: 500;
  src: url('${fontUrl('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2')}') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-weight: 500;
  src: url('${fontUrl('@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-500-normal.woff2')}') format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
@page { size: A4; margin: 18mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  background: ${day['bg/surface']};
  color: ${day['text/primary']};
  font-family: 'Bricolage Grotesque Variable', 'Segoe UI', sans-serif;
  font-size: 10.5px;
  line-height: 1.45;
}
body.preview { width: 210mm; padding: 18mm; }
a { color: inherit; text-decoration: none; }
.mono { font-family: 'IBM Plex Mono', monospace; font-weight: 500; }
header { padding-left: 14px; border-left: 4px solid ${day['accent/primary']}; }
.name { font-size: 26px; line-height: 1.1; font-weight: 800; letter-spacing: -0.01em; }
.role { margin-top: 4px; font-size: 14px; font-weight: 600; }
.contacts { margin-top: 6px; font-size: 10.5px; color: ${day['text/secondary']}; }
.contacts a { color: ${day['text/primary']}; }
section { margin-top: 12px; padding-top: 7px; border-top: 1px solid ${day['border/default']}; }
h2 {
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: ${day['text/secondary']}; margin-bottom: 6px;
}
p { font-size: 11px; }
.skills { font-size: 11px; line-height: 1.6; }
.job { break-inside: avoid; }
.job + .job { margin-top: 10px; padding-top: 10px; border-top: 1px solid ${day['border/default']}; }
.job__head { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
.job__title { font-size: 12.5px; font-weight: 700; }
.job__where { font-size: 11px; color: ${day['text/secondary']}; }
.job__period { font-family: 'IBM Plex Mono', monospace; font-weight: 500; font-size: 10.5px; white-space: nowrap; color: ${day['text/secondary']}; }
.job__intro { margin-top: 4px; }
ul { margin-top: 4px; padding-left: 14px; }
li { font-size: 11px; margin-top: 2px; }
.job__stack { margin-top: 5px; font-size: 10.5px; color: ${day['text/secondary']}; }
.label { font-weight: 700; }
.rows { display: grid; grid-template-columns: max-content 1fr; column-gap: 14px; row-gap: 3px; font-size: 11px; }
.langs { font-size: 11px; }
</style></head><body>
  <header>
    <h1 class="name">${escapeHtml(cv.name)}</h1>
    <div class="role">${escapeHtml(cv.role)}</div>
    <div class="contacts">${cv.contacts.map(link).join(' · ')} · ${escapeHtml(cv.location)}</div>
  </header>
  <section><h2>${escapeHtml(labels.summary)}</h2><p>${escapeHtml(cv.summary)}</p></section>
  <section><h2>${escapeHtml(labels.skills)}</h2><div class="skills">${cv.skills.map(escapeHtml).join(' · ')}</div></section>
  <section><h2>${escapeHtml(labels.experience)}</h2>${cv.experience.map((job) => experienceHtml(cv, job)).join('')}</section>
  <section><h2>${escapeHtml(labels.education)}</h2><div class="rows">${cv.education
    .map(
      (e) =>
        `<span class="mono">${escapeHtml(e.year)}</span><span>${escapeHtml(e.degree)} — ${escapeHtml(e.school)}</span>`,
    )
    .join('')}</div></section>
  <section><h2>${escapeHtml(labels.courses)}</h2><div class="rows">${cv.courses
    .map((c) => `<span class="mono">${escapeHtml(c.year)}</span><span>${escapeHtml(c.text)}</span>`)
    .join('')}</div></section>
  <section><h2>${escapeHtml(labels.languages)}</h2><div class="langs">${cv.languages
    .map((l) => `${escapeHtml(l.name)} — ${escapeHtml(l.level)}`)
    .join(' · ')}</div></section>
</body></html>`
}

/** Минимальный CDP-клиент поверх встроенного WebSocket (Node ≥ 22). */
async function connect(wsUrl) {
  const socket = new WebSocket(wsUrl)
  await new Promise((ok, fail) => {
    socket.addEventListener('open', ok, { once: true })
    socket.addEventListener('error', fail, { once: true })
  })
  let nextId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (message.id === undefined) return
    const call = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) call?.fail(new Error(message.error.message))
    else call?.ok(message.result)
  })
  return {
    send(method, params = {}) {
      const id = ++nextId
      socket.send(JSON.stringify({ id, method, params }))
      return new Promise((ok, fail) => pending.set(id, { ok, fail }))
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

async function evaluate(page, expression) {
  const { result, exceptionDetails } = await page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (exceptionDetails) throw new Error(exceptionDetails.text)
  return result.value
}

async function withPage(work) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, {
    method: 'PUT',
  })
  const target = await response.json()
  const page = await connect(target.webSocketDebuggerUrl)
  try {
    const { frameTree } = await page.send('Page.getFrameTree')
    return await work(page, frameTree.frame.id)
  } finally {
    page.close()
    await fetch(`http://127.0.0.1:${debugPort}/json/close/${target.id}`)
  }
}

async function loadDocument(page, frameId, html) {
  await page.send('Page.setDocumentContent', { frameId, html })
  const fonts = await evaluate(
    page,
    `document.fonts.ready.then(() => [...document.fonts].map((f) => f.family + ' ' + f.weight + ' ' + f.status))`,
  )
  // Неиспользуемый unicode-range (кириллица Plex Mono в EN) остаётся «unloaded» — это нормально.
  const failed = fonts.filter((font) => font.endsWith(' error'))
  if (failed.length > 0 || !fonts.some((font) => font.endsWith(' loaded')))
    throw new Error(`fonts not loaded: ${fonts.join(', ')}`)
}

async function renderPdf(cv) {
  const file = join(outDir, cv.file)
  await withPage(async (page, frameId) => {
    await loadDocument(page, frameId, cvHtml(cv))
    const { data } = await page.send('Page.printToPDF', {
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
    })
    writeFileSync(file, Buffer.from(data, 'base64'))
    const pages = (
      Buffer.from(data, 'base64')
        .toString('latin1')
        .match(/\/Type\s*\/Page[^s]/g) ?? []
    ).length
    console.log(`wrote ${file} (${pages} page(s), ${Math.round(data.length * 0.75) / 1024} KiB)`)
  })
}

async function renderPreview(cv) {
  const width = 794
  const file = join(previewDir, cv.file.replace(/\.pdf$/, '.png'))
  await withPage(async (page, frameId) => {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1123,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await loadDocument(page, frameId, cvHtml(cv).replace('<body>', '<body class="preview">'))
    const height = await evaluate(page, 'document.documentElement.scrollHeight')
    const { data } = await page.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    })
    writeFileSync(file, Buffer.from(data, 'base64'))
    console.log(`wrote ${file} (${width}×${height})`)
  })
}

if (!existsSync(chrome)) {
  console.error(`Chrome not found at ${chrome}; set CHROME_PATH`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
if (previewDir) mkdirSync(previewDir, { recursive: true })

// Свой временный профиль: профиль пользователя не трогаем.
const profile = mkdtempSync(join(tmpdir(), 'aboutme-cv-'))
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
  for (const cv of cvs) {
    await renderPdf(cv)
    if (previewDir) await renderPreview(cv)
  }
} finally {
  browser.kill()
  await delay(500)
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
