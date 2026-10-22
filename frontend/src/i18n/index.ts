import { watch } from 'vue'
import { createI18n, useI18n } from 'vue-i18n'
import { useUiStore } from '../stores/ui'
import en from './en.json'
import ru from './ru.json'

export type MessageSchema = typeof en

export function createAppI18n() {
  return createI18n<[MessageSchema], 'en' | 'ru'>({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en, ru },
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
      locale.value = lang
      // TODO(этап 3, FR8): выставлять <html lang> вместе с RU-контентом. Пока контент только EN,
      // <html lang="en"> из index.html не меняем — иначе скринридер прочтёт английский текст как русский.
    },
    { immediate: true },
  )
}
