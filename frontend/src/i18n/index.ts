import { watch } from 'vue'
import { createI18n, useI18n } from 'vue-i18n'
import type { ChapterId } from '../content/chapters'
import { useUiStore, type Lang } from '../stores/ui'
import { compileMessage } from './compile'
import en from './en.json'
import ru from './ru.json'

export type MessageSchema = typeof en

/** `locale` — стартовый язык (в приложении его сразу задаёт useLocaleSync; параметр — для тестов). */
export function createAppI18n(locale: Lang = 'en') {
  return createI18n<[MessageSchema], 'en' | 'ru'>({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages: { en, ru },
    messageCompiler: compileMessage,
  })
}

/**
 * Держит глобальную локаль i18n в соответствии с `ui.lang`.
 * Источник правды — стор: смена `setLang` меняет `i18n.global.locale`.
 * Вызывается один раз в корневом компоненте.
 */
export function useLocaleSync() {
  const ui = useUiStore()
  const { locale } = useI18n({ useScope: 'global' })
  watch(
    () => ui.lang,
    (lang) => {
      // <html lang> ставит head.ts по языку контента: бандлы EN и RU есть, поэтому он следует за `ui.lang`.
      locale.value = lang
    },
    { immediate: true },
  )
}

export interface ChapterLabel {
  title: string
  subtitle: string
}

/** Подпись главы в баре, пинах и prev/next на текущем языке интерфейса (UX16: ≤ 14 символов). */
export function useChapterLabel(): (id: ChapterId) => ChapterLabel {
  const { t } = useI18n({ useScope: 'global' })
  return (id) => ({ title: t(`chapters.${id}.title`), subtitle: t(`chapters.${id}.subtitle`) })
}

const MESSAGES: Record<Lang, MessageSchema> = { en, ru }

/**
 * Та же подпись без инъекции i18n — для компонентов внутри TresCanvas (scene/Labels.vue): у его
 * рендерера свой контекст приложения, provide корневого приложения туда не доходит.
 */
export function chapterLabel(id: ChapterId, lang: Lang): ChapterLabel {
  return MESSAGES[lang].chapters[id]
}
