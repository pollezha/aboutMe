import { createRouter, type RouteRecordRaw, type RouterHistory } from 'vue-router'
import type { Lang } from './useLangStore'

// Страница одна (App — корень, RouterView нет): маршрут задаёт только язык.
// Окна глав — URL-хэш (windows/useWindowHistory.ts).
const Page = { name: 'LangPage', render: () => null }

export const routes: RouteRecordRaw[] = [
  { path: '/', component: Page, meta: { lang: 'en' } },
  { path: '/ru/', component: Page, meta: { lang: 'ru' } },
]

export function pathFor(lang: Lang): string {
  return lang === 'ru' ? '/ru/' : '/'
}

export function langOf(path: string): Lang {
  return /^\/ru(\/|$)/.test(path) ? 'ru' : 'en'
}

export function createAppRouter(history: RouterHistory) {
  return createRouter({ history, routes })
}
