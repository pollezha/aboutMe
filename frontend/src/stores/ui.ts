import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Lang = 'en' | 'ru'

export const useUiStore = defineStore('ui', () => {
  const lang = ref<Lang>('en')
  function setLang(next: Lang) {
    lang.value = next
  }
  return { lang, setLang }
})
