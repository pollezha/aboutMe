import { expect, test, type Locator, type Page } from '@playwright/test'
import { ROUTE, expectWindow, openDialog, openSite, stop, t } from './support'

// TC-04 / AC4: только клавиатура. Tab доходит до 6 остановок, Contact, Monitoring, темы и языка; бар —
// канонический порядок, подписи сцены (tabindex=-1) в него не входят. Enter открывает окно, фокус внутри
// и заперт; Esc закрывает и возвращает фокус на кнопку остановки.

const MAX_TABS = 80

/** Подпись элемента в фокусе: aria-label или текст; null — фокус вне документа/на body. */
function focusedName(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    return (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
  })
}

async function isFocused(locator: Locator) {
  return locator.evaluate((el) => el === document.activeElement)
}

/** Жмёт Tab, пока фокус не встанет на элемент. */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab')
    if (await isFocused(target)) return
  }
  throw new Error(`Tab did not reach ${target}`)
}

test('Tab reaches all 6 stops in order, Contact, Monitoring, theme and language', async ({
  page,
}) => {
  await openSite(page)
  const focused: { name: string; stop: number; sceneLabel: boolean }[] = []
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab')
    const name = await focusedName(page)
    if (name === null) break
    const where = await page.evaluate(() => {
      const el = document.activeElement
      const item = el?.closest('nav ol > li')
      return {
        stop: item ? [...item.parentElement!.children].indexOf(item) : -1,
        sceneLabel: !!el?.closest('.scene-label'),
      }
    })
    focused.push({ name, ...where })
  }
  const names = focused.map((f) => f.name)
  test.info().annotations.push({ type: 'tab order', description: names.join(' | ') })

  // Остановки — подряд и по порядку маршрута, каждая один раз.
  expect(focused.filter((f) => f.stop >= 0).map((f) => f.stop)).toEqual(ROUTE.map((_, i) => i))
  expect(names).toContain(t.hero.contact)
  expect(names.some((n) => n.startsWith(t.bar.monitoring))).toBe(true)
  expect(names.some((n) => n.startsWith('Theme:'))).toBe(true)
  expect(names).toContain(t.lang.label)
  expect(focused.filter((f) => f.sceneLabel)).toEqual([])
})

test('Enter opens a stop, focus stays in the dialog, Esc closes and returns focus', async ({
  page,
}) => {
  await openSite(page)
  const button = stop(page, 1)
  await tabTo(page, button)
  await page.keyboard.press('Enter')
  const dialog = await expectWindow(page, 'prospace')

  const inDialog = () => page.evaluate(() => !!document.activeElement?.closest('dialog[open]'))
  expect(await inDialog()).toBe(true)

  // Фокус заперт: ни вперёд, ни назад он не попадает на страницу под окном. Модальный <dialog> делает
  // её inert; после последнего элемента окна Chrome отдаёт фокус своему UI (в документе — body), затем
  // снова первому элементу окна — это поведение платформы, а не утечка.
  const outside: string[] = []
  for (const key of [...Array(40).fill('Tab'), ...Array(40).fill('Shift+Tab')] as string[]) {
    await page.keyboard.press(key)
    const name = await focusedName(page)
    if (name !== null && !(await inDialog())) outside.push(`${key}: ${name}`)
  }
  expect(outside).toEqual([])

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(button).toBeFocused()
})

test('390: in Tech stack Esc closes only the server sheet, then the window', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'phone-390', 'bottom sheet: phone only')
  await openSite(page)
  await tabTo(page, stop(page, 3))
  await page.keyboard.press('Enter')
  await expectWindow(page, 'techstack')

  const server = openDialog(page).locator('.rack-server').first()
  await tabTo(page, server)
  await page.keyboard.press('Enter')
  const sheet = openDialog(page).locator('.bottom-sheet [role="dialog"]')
  await expect(sheet).toBeVisible()
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true)

  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expectWindow(page, 'techstack')
  await expect(server).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(openDialog(page)).toHaveCount(0)
  await expect(stop(page, 3)).toBeFocused()
})
