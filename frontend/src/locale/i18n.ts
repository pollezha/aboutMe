import { createI18n, useI18n } from 'vue-i18n'
import type { ChapterId } from '../content'
import { compileMessage } from './compile'
import en from './en.json'
import ru from './ru.json'
import type { Lang } from './useLangStore'

export type MessageSchema = typeof en

/** `locale` — стартовый язык (в приложении его сразу задаёт useRouteLang; параметр — для тестов). */
export function createAppI18n(locale: Lang = 'en') {
  return createI18n<[MessageSchema], 'en' | 'ru'>({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages: { en, ru },
    messageCompiler: compileMessage,
  })
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
