import { useHead, type ReactiveHead } from '@unhead/vue'
import { computed } from 'vue'
import { type ContentBundle, type ContentLang, resolveHighlights } from './content'
import { pathFor } from './locale'
import { TEXT_FONT_PRELOADS } from './theme'

/** Подмножество тегов unhead, которое строит siteHead. */
export interface HeadTag {
  name?: string
  property?: string
  content?: string
  rel?: string
  hreflang?: string
  href?: string
  as?: string
  type?: string
  crossorigin?: string
}

export interface SiteHeadInput {
  content: ContentBundle
  /** Языки, для которых есть контент (hreflang). */
  langs: readonly ContentLang[]
  /** Origin сайта; пусто — относительные URL и без og:url (абсолютные — T13). */
  origin?: string
  now?: Date
}

const DESCRIPTION_MAX = 160
const OG_LOCALE: Record<ContentLang, string> = { en: 'en_US', ru: 'ru_RU' }

/** «Роль · статус · формат · локация.» и ключевые цифры, пока описание ≤ 160 символов. */
function describe(content: ContentBundle, now?: Date): string {
  const { role, status, workFormat, location } = content.profile
  let text = `${role} · ${status} · ${workFormat} · ${location}.`
  const numbers = resolveHighlights(content, now)
    .filter((metric) => metric.value)
    .map((metric) => `${metric.value} ${metric.label.toLowerCase()}`)
  for (const number of numbers) {
    const next = `${text} ${number}.`
    if (next.length > DESCRIPTION_MAX) break
    text = next
  }
  return text
}

/**
 * title, description, Open Graph, canonical и hreflang (+ x-default → /) страницы на языке контента (FR11),
 * preload шрифтов текста этого языка.
 */
export function siteHead({ content, langs, origin = '', now }: SiteHeadInput) {
  const base = origin.replace(/\/+$/, '')
  const url = (path: string) => `${base}${path}`
  const { name, role, status } = content.profile
  const title = `${name} — ${role}`
  const description = describe(content, now)
  const self = url(pathFor(content.lang))
  const image = url('/og.png')

  const meta: HeadTag[] = [
    // unhead по умолчанию ставит свой viewport — без viewport-fit=cover (вырез и home indicator).
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:locale', content: OG_LOCALE[content.lang] },
    ...(base ? [{ property: 'og:url', content: self }] : []),
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: `${name}, ${role} · ${status}` },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ]
  const link: HeadTag[] = [
    { rel: 'canonical', href: self },
    ...langs.map((lang) => ({ rel: 'alternate', hreflang: lang, href: url(pathFor(lang)) })),
    { rel: 'alternate', hreflang: 'x-default', href: url('/') },
    // Шрифты текста страницы — параллельно с CSS (T12b); crossorigin обязателен для шрифтов.
    ...TEXT_FONT_PRELOADS[content.lang].map((href) => ({
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href,
      crossorigin: '',
    })),
  ]
  return { title, htmlAttrs: { lang: content.lang }, meta, link }
}

/** Head страницы следует за контентом (смена языка без перезагрузки обновляет title и `<html lang>`). */
export function useSiteHead(input: () => SiteHeadInput) {
  // HeadTag — узкое подмножество тегов unhead; ReactiveHead требует ещё индекс data-*.
  useHead(computed(() => siteHead(input()) as ReactiveHead))
}
