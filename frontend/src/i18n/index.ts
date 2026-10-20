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
 * Источник правды — стор: смена `setLang` меняет `i18n.global.locale` и `<html lang>`.
 * Вызывается один раз в корневом компоненте.
 */
export function useLocaleSync() {
  const ui = useUiStore()
  const { locale } = useI18n({ useScope: 'global' })
  watch(
    () => ui.lang,
    (lang) => {
      locale.value = lang
      if (typeof document !== 'undefined') document.documentElement.lang = lang
    },
    { immediate: true },
  )
}
