// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createPinia } from 'pinia'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory } from 'vue-router'
import { createHead, renderSSRHead } from '@unhead/vue/server'
import en from '../../../content/en.json'
import App from '../App.vue'
import { CHAPTERS } from '../content/chapters'
import { resolveChapter } from '../content/format'
import type { ContentBundle } from '../content/types'
import { createAppI18n } from '../i18n'
import { createAppRouter } from '../router'

const content = en as ContentBundle

/** Prerender the page the way vite-ssg does: no window, memory history, server head. */
async function prerender(path: string) {
  const app = createSSRApp(App)
  const head = createHead()
  const router = createAppRouter(createMemoryHistory())
  app.use(createPinia()).use(createAppI18n()).use(router).use(head)
  await router.push(path)
  await router.isReady()
  const html = await renderToString(app)
  return { html: decode(html), head: await renderSSRHead(head) }
}

function decode(html: string) {
  return html
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

describe('prerendered page (FR11, TC-11)', () => {
  it('contains the heading and body text of all 8 chapters with every window closed', async () => {
    const { html } = await prerender('/')

    expect(CHAPTERS).toHaveLength(8)
    for (const { id } of CHAPTERS) {
      expect(html, id).toContain(resolveChapter(content, id).title)
    }
    for (const item of content.chapters.prospace.keyResults.items) {
      expect(html).toContain(item.result)
    }
    expect(html).toContain(content.chapters.contact.subtitle)
    expect(html).not.toMatch(/<dialog[^>]*\sopen/)
  })

  it('renders the hero and the route bar', async () => {
    const { html } = await prerender('/')

    expect(html).toContain('Yakov Polezhaev')
    expect(html).toContain('.NET Backend Developer')
    expect(html).toContain('bottom-bar')
  })

  it('renders /ru/ with the Russian interface and the hreflang links', async () => {
    const { html, head } = await prerender('/ru/')

    expect(html).toContain('Яков Полежаев')
    expect(head.headTags).toContain('hreflang="x-default"')
    expect(head.headTags).toContain('<title>')
  })
})
