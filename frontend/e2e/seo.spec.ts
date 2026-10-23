import { expect, test } from '@playwright/test'
import en from '../../content/en.json' with { type: 'json' }
import ru from '../../content/ru.json' with { type: 'json' }

// TC-11 / FR11: HTML без JS (как curl) — предрендер vite-ssg. На своём языке: заголовки всех 8 глав,
// title, description, Open Graph; взаимные hreflang en/ru + x-default.

const PAGES = [
  { path: '/', lang: 'en', content: en },
  { path: '/ru/', lang: 'ru', content: ru },
] as const

/** Текст HTML без тегов-атрибутов: &amp; и т. п. раскрыты, как их увидит поисковик. */
function decode(html: string) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

for (const { path, lang, content } of PAGES) {
  test(`${path} without JS has all chapters, title, description and hreflang`, async ({
    request,
  }) => {
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('text/html')
    const html = decode(await response.text())

    expect(html).toMatch(new RegExp(`<html[^>]*lang="${lang}"`))
    const headings = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1]!.trim())
    for (const chapter of Object.values(content.chapters)) expect(headings).toContain(chapter.title)

    const title = html.match(/<title>([^<]+)<\/title>/)?.[1]
    expect(title).toContain(content.profile.name)
    expect(html).toMatch(/<meta name="description" content="[^"]{50,}"/)
    expect(html).toMatch(/<meta property="og:title" content="[^"]+"/)
    expect(html).toMatch(/<meta property="og:image" content="[^"]+"/)
    for (const [hreflang, href] of [
      ['en', '/'],
      ['ru', '/ru/'],
      ['x-default', '/'],
    ]) {
      expect(html).toMatch(
        new RegExp(`<link rel="alternate" hreflang="${hreflang}" href="[^"]*${href}"`),
      )
    }
  })
}
