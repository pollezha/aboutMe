// Шрифты основного текста первого экрана, которые <head> предзагружает (head.ts, T12b): без preload их запрос
// стартует только после CSS и раскладки — на RTT позже. Те же файлы, что в fonts.css (Vite даёт им один URL).
// Только текст: IBM Plex Mono (подписи) и cyrillic-ext не предзагружаются — замер не показал выигрыша LCP.
import bricolageLatin from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url'
import onestCyrillic from '@fontsource-variable/onest/files/onest-cyrillic-wght-normal.woff2?url'
import type { ContentLang } from '../content/types'

export const TEXT_FONT_PRELOADS: Readonly<Record<ContentLang, readonly string[]>> = {
  en: [bricolageLatin],
  ru: [bricolageLatin, onestCyrillic],
}
