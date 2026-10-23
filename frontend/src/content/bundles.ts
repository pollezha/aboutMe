import type { ContentBundle, ContentLang } from './types'

// Снимки контента content/<lang>.json, какие есть на момент сборки.
const modules = import.meta.glob<ContentBundle>('../../../content/*.json', {
  eager: true,
  import: 'default',
})

const BUNDLES: Partial<Record<ContentLang, ContentBundle>> = Object.fromEntries(
  Object.values(modules).map((bundle) => [bundle.lang, bundle]),
)

/** Языки, для которых есть контент: по ним — hreflang и `<html lang>`. */
export const CONTENT_LANGS: readonly ContentLang[] = (['en', 'ru'] as const).filter(
  (lang) => BUNDLES[lang],
)

/** Контент на языке интерфейса; пока перевода нет — английский. */
export function contentFor(lang: ContentLang): ContentBundle {
  const bundle = BUNDLES[lang] ?? BUNDLES.en
  if (!bundle) throw new Error('content/en.json is missing')
  return bundle
}
