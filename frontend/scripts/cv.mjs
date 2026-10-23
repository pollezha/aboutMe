// Резюме EN/RU в PDF: HTML-шаблон → headless Chrome (Page.printToPDF) → frontend/public/cv/*.pdf.
// Тот же приём, что og.mjs: Chrome через scripts/cdp.mjs, шрифты data:-URL из node_modules.
// Латиница — Bricolage Grotesque (на сайте), числа и даты — IBM Plex Mono (latin + cyrillic).
// Кириллицу Bricolage не содержит: для RU-текста Chrome поглифно откатывается на 'Segoe UI' (Windows);
// PDF встраивает использованные глифы, так что файл самодостаточен. Данные — scripts/cv-data.mjs.
// Переменная CV_PREVIEW_DIR — туда дополнительно снимаются PNG шаблона (794×N) для визуальной проверки.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { palette } from '../src/theme/palette.ts'
import { launchChrome } from './cdp.mjs'
import { cvs } from './cv-data.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public', 'cv')
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
  font-family: 'Onest Variable';
  font-weight: 100 900;
  src: url('${fontUrl('@fontsource-variable/onest/files/onest-cyrillic-ext-wght-normal.woff2')}') format('woff2-variations');
  unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
}
@font-face {
  font-family: 'Onest Variable';
  font-weight: 100 900;
  src: url('${fontUrl('@fontsource-variable/onest/files/onest-cyrillic-wght-normal.woff2')}') format('woff2-variations');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
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
@page { size: A4; margin: 16mm 18mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  background: ${day['bg/surface']};
  color: ${day['text/primary']};
  font-family: 'Bricolage Grotesque Variable', 'Onest Variable', system-ui, sans-serif;
  font-size: 10.5px;
  line-height: 1.4;
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

async function loadDocument(page, html) {
  await page.setContent(html)
  const fonts = await page.evaluate(
    `document.fonts.ready.then(() => [...document.fonts].map((f) => f.family + ' ' + f.weight + ' ' + f.status))`,
  )
  // Неиспользуемый unicode-range (кириллица Plex Mono в EN) остаётся «unloaded» — это нормально.
  const failed = fonts.filter((font) => font.endsWith(' error'))
  if (failed.length > 0 || !fonts.some((font) => font.endsWith(' loaded')))
    throw new Error(`fonts not loaded: ${fonts.join(', ')}`)
}

async function renderPdf(browser, cv) {
  const file = join(outDir, cv.file)
  await browser.withPage(async (page) => {
    await loadDocument(page, cvHtml(cv))
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
    })
    writeFileSync(file, pdf)
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    console.log(`wrote ${file} (${pages} page(s), ${Math.round(pdf.length / 1024)} KiB)`)
  })
}

async function renderPreview(browser, cv) {
  const width = 794
  const file = join(previewDir, cv.file.replace(/\.pdf$/, '.png'))
  await browser.withPage(async (page) => {
    await page.setViewport({ width, height: 1123 })
    await loadDocument(page, cvHtml(cv).replace('<body>', '<body class="preview">'))
    const height = await page.evaluate('document.documentElement.scrollHeight')
    const png = await page.screenshot({
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    })
    writeFileSync(file, png)
    console.log(`wrote ${file} (${width}×${height})`)
  })
}

mkdirSync(outDir, { recursive: true })
if (previewDir) mkdirSync(previewDir, { recursive: true })

const browser = await launchChrome({ prefix: 'aboutme-cv-' })
try {
  for (const cv of cvs) {
    await renderPdf(browser, cv)
    if (previewDir) await renderPreview(browser, cv)
  }
} finally {
  await browser.close()
}
