// Модуль windows: окно открытой главы (WindowHost — данные, тело из реестра, хэш и история),
// предрендер текста всех глав и ссылки-доказательства. В главном чанке, без import().
// Зависит от chapters, content, locale, route, shared/*.
export { default as ChapterWindow } from './ChapterWindow.vue'
export { default as PrerenderedChapters } from './PrerenderedChapters.vue'
export { default as ProofLinks } from './ProofLinks.vue'
export { default as WindowHost } from './WindowHost.vue'
export { useChapterWindow } from './useChapterWindow'
export { useWindowHistory } from './useWindowHistory'
