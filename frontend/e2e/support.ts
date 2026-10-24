import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import en from '../src/locale/en.json' with { type: 'json' }

// Общие шаги e2e: открыть сайт в нужном режиме, найти остановки и окно. Имена — из i18n (как у getByRole).

export const THEMES = ['day', 'evening', 'night'] as const
export type Theme = (typeof THEMES)[number]

/** Шесть остановок маршрута в порядке резюме (бар каноничен). */
export const ROUTE = [
  'profile',
  'prospace',
  'timepath',
  'techstack',
  'education',
  'contact',
] as const
/** Все 8 окон: маршрут + Monitoring и 30-sec summary (вне маршрута). */
export const WINDOWS = [...ROUTE, 'monitoring', 'summary'] as const
export type WindowId = (typeof WINDOWS)[number]

export const t = en

/** На телефоне и без WebGL сайт сам в 2D; на десктопе — 3D. */
export function expects2D(info: TestInfo) {
  return info.project.name !== 'desktop-1280'
}

export interface OpenOptions {
  theme?: Theme
  mode?: '2d' | '3d'
  hash?: WindowId
  path?: string
}

/** Открывает сайт и ждёт готовности режима: 2D-карту или первый кадр 3D-сцены (mark `scene_ready`). */
export async function openSite(page: Page, options: OpenOptions = {}) {
  const query = new URLSearchParams()
  if (options.theme) query.set('theme', options.theme)
  if (options.mode) query.set('mode', options.mode)
  const search = query.size ? `?${query}` : ''
  await page.goto(`${options.path ?? '/'}${search}${options.hash ? `#${options.hash}` : ''}`)
  await expect(page.locator('.app')).toHaveClass(/app--(2d|3d)/)
  if (await page.locator('.app--3d').count()) await waitForScene(page)
  else await expect(page.locator('.static-map .hotspot').first()).toBeVisible()
}

export async function waitForScene(page: Page) {
  await page.waitForFunction(() => performance.getEntriesByName('scene_ready').length > 0, null, {
    timeout: 15_000,
  })
}

export function bar(page: Page): Locator {
  return page.getByRole('navigation', { name: t.bar.nav })
}

/** Кнопка остановки маршрута по номеру 0…5 (имя меняется: номер → галочка после визита). */
export function stop(page: Page, index: number): Locator {
  return bar(page).getByRole('listitem').nth(index).getByRole('button')
}

export function openDialog(page: Page): Locator {
  return page.locator('dialog[open]')
}

export async function expectWindow(page: Page, id: WindowId) {
  const dialog = openDialog(page)
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-chapter', id)
  await expect(page).toHaveURL(new RegExp(`#${id}$`))
  return dialog
}

/** 2D-хотспот главы: имя «02 ProSpace · Latest role», у Monitoring без номера. */
export function hotspot(page: Page, id: Exclude<WindowId, 'summary'>): Locator {
  const { title, subtitle } = t.chapters[id]
  return page.locator('.static-map').getByRole('button', { name: `${title} · ${subtitle}` })
}
