import { createHead } from '@unhead/vue/client'
import type { Pinia } from 'pinia'
import { createWebHistory } from 'vue-router'
import { createAppI18n } from '../i18n'
import { createAppRouter } from '../router'

/** Плагины App, как в main.ts (vite-ssg): i18n, роутер на текущем location, head. Pinia — от теста. */
export function appPlugins(pinia: Pinia) {
  return [pinia, createAppI18n(), createAppRouter(createWebHistory()), createHead()]
}
