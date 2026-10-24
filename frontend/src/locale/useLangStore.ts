import { defineStore } from 'pinia'
import { ref } from 'vue'
import { load, save } from '../shared/lib'

export type Lang = 'en' | 'ru'

export const LANGS: readonly Lang[] = ['en', 'ru']

/** Тот же ключ читает boot-скрипт до старта приложения (theme/boot.ts): выбор языка ведёт на / или /ru/. */
const KEY = 'aboutme.lang'

export function isLang(value: string | null): value is Lang {
  return LANGS.includes(value as Lang)
}

export const useLangStore = defineStore('lang', () => {
  const saved = load(KEY)
  const lang = ref<Lang>(isLang(saved) ? saved : 'en')

  /** Выбор пользователя (переключатель): запоминается; useRouteLang переводит маршрут на /ru/ или /. */
  function setLang(next: Lang) {
    lang.value = next
    save(KEY, next)
  }

  /** Язык из маршрута (/ или /ru/): ссылка на страницу — не выбор пользователя, не запоминаем. */
  function syncLang(next: Lang) {
    lang.value = next
  }

  function toggleLang() {
    setLang(lang.value === 'en' ? 'ru' : 'en')
  }

  return { lang, setLang, syncLang, toggleLang }
})
