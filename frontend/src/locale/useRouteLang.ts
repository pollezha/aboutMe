import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { langOf, pathFor } from './routes'
import { useLangStore } from './useLangStore'

/**
 * Язык страницы задаёт маршрут (/ или /ru/): он попадает в стор без запоминания (syncLang); выбор
 * пользователя (setLang) меняет маршрут без перезагрузки, сохраняя query и открытое окно (#hash).
 * Глобальная локаль i18n следует за стором. `<html lang>` ставит head.ts по языку контента — он берётся
 * из того же стора. Вызывается один раз в корневом компоненте.
 */
export function useRouteLang() {
  const store = useLangStore()
  const route = useRoute()
  const router = useRouter()
  const { locale } = useI18n({ useScope: 'global' })

  const routeLang = computed(() => langOf(route.path))
  watch(routeLang, (lang) => store.syncLang(lang), { immediate: true })
  watch(
    () => store.lang,
    (lang) => {
      if (lang === routeLang.value) return
      // Хэш окна главы ведёт App, а не роутер: берём его из адресной строки.
      const hash = typeof window !== 'undefined' ? window.location.hash : route.hash
      router.push({ path: pathFor(lang), query: route.query, hash })
    },
  )
  watch(
    () => store.lang,
    (lang) => {
      locale.value = lang
    },
    { immediate: true },
  )

  return { store }
}
