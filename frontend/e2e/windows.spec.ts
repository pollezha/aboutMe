import { expect, test, type Page } from '@playwright/test'
import en from '../../content/en.json' with { type: 'json' }
import {
  ROUTE,
  THEMES,
  expectWindow,
  expects2D,
  hotspot,
  openDialog,
  openSite,
  stop,
  t,
} from './support'

// TC-02 (остановки и prev/next), TC-03/AC3 (окно ≤ 600 мс), TC-07/AC6 (2D: все 8 окон), TC-08 (темы, ?mode=).

const prevButton = (page: Page) => openDialog(page).getByRole('button', { name: /^←/ })
const nextButton = (page: Page) =>
  openDialog(page).getByRole('button', { name: new RegExp(`^${t.window.next}:`) })

test.describe('TC-02: route stops', () => {
  test('each of the 6 stops in the bar opens its own chapter', async ({ page }) => {
    await openSite(page)
    for (const [index, id] of ROUTE.entries()) {
      await stop(page, index).click()
      await expectWindow(page, id)
      await page.keyboard.press('Escape')
      await expect(openDialog(page)).toHaveCount(0)
    }
  })

  test('prev/next walk the route in CV order; 01 has no prev, 06 has no next', async ({ page }) => {
    await openSite(page)
    await stop(page, 0).click()
    await expectWindow(page, 'profile')
    await expect(prevButton(page)).toHaveCount(0)
    for (const id of ROUTE.slice(1)) {
      await nextButton(page).click()
      await expectWindow(page, id)
    }
    await expect(nextButton(page)).toHaveCount(0)
    for (const id of ROUTE.slice(0, -1).reverse()) {
      await prevButton(page).click()
      await expectWindow(page, id)
    }
    await expect(prevButton(page)).toHaveCount(0)
  })

  test('3D: clicking the ProSpace label and the building opens #prospace', async ({
    page,
  }, info) => {
    test.skip(expects2D(info), '3D scene: desktop only')
    await openSite(page)
    const label = page.locator('.scene-label', { hasText: t.chapters.prospace.title })
    await label.click()
    await expectWindow(page, 'prospace')
    await page.keyboard.press('Escape')
    await expect(openDialog(page)).toHaveCount(0)

    // Здание — под подписью (подпись висит над крышей): клик по canvas, выбор лучом (scene/pick.ts).
    const box = await label.boundingBox()
    if (!box) throw new Error('ProSpace label has no box')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height + 40)
    await expectWindow(page, 'prospace')
  })
})

test.describe('TC-03 / AC3: Contact opens fast', () => {
  test('from click on Contact to a visible dialog ≤ 600 ms', async ({ page }, info) => {
    await openSite(page)
    // На телефоне Contact бара скрыт (2D-бар — только остановки) — Contact в Hero.
    const scope =
      info.project.name === 'phone-390' ? page.locator('.app__hero') : page.locator('nav')
    const contact = scope.getByRole('button', { name: t.bar.contact, exact: true })
    await expect(contact).toBeVisible()
    const handle = await contact.elementHandle()
    // Замер в браузере: click() → первый кадр, где <dialog open> виден.
    const ms = await page.evaluate(
      (button) =>
        new Promise<number>((resolve) => {
          const start = performance.now()
          ;(button as HTMLElement).click()
          const poll = () => {
            const dialog = document.querySelector('dialog[open]')
            if (dialog?.checkVisibility()) resolve(performance.now() - start)
            else requestAnimationFrame(poll)
          }
          poll()
        }),
      handle,
    )
    await expectWindow(page, 'contact')
    info.annotations.push({ type: 'AC3 click→dialog, ms', description: ms.toFixed(1) })
    console.log(`[${info.project.name}] AC3 click→dialog: ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThanOrEqual(600)
  })
})

test.describe('TC-07 / AC6: 2D map', () => {
  test('2D mode: the map and all 8 windows open', async ({ page }, info) => {
    test.skip(!expects2D(info), '2D by itself: no-webgl and 390 only')
    await openSite(page)
    await expect(page.locator('.app')).toHaveClass(/app--2d/)
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(page.locator('.static-map img')).toBeVisible()

    for (const id of [...ROUTE, 'monitoring'] as const) {
      await hotspot(page, id).click()
      const dialog = await expectWindow(page, id)
      if (info.project.name === 'phone-390') await expectFullScreen(page, dialog)
      await page.keyboard.press('Escape')
      await expect(openDialog(page)).toHaveCount(0)
    }

    // 30-sec summary — вне карты: кнопка в окне Contact (она же в его proof-ссылках) и прямой хэш.
    await hotspot(page, 'contact').click()
    await expectWindow(page, 'contact')
    await openDialog(page)
      .getByRole('button', { name: en.chapters.contact.summaryLink.label })
      .first()
      .click()
    await expectWindow(page, 'summary')
    await page.keyboard.press('Escape')
    await page.goto('/#summary')
    await expectWindow(page, 'summary')
  })
})

async function expectFullScreen(page: Page, dialog: ReturnType<typeof openDialog>) {
  // Появление окна — scale(0.98 → 1): меряем после анимации.
  await dialog.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  const box = await dialog.locator('.window').boundingBox()
  const viewport = page.viewportSize()
  if (!box || !viewport) throw new Error('no window box')
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1)
}

test.describe('TC-08: themes and mode', () => {
  test('theme cycle day → evening → night → day changes data-theme and theme-color', async ({
    page,
  }, info) => {
    await openSite(page, { theme: 'day' })
    const html = page.locator('html')
    const meta = page.locator('meta[name="theme-color"]')
    const colors = new Set<string>()
    for (const theme of [...THEMES.slice(1), THEMES[0]]) {
      await page.getByRole('button', { name: /^Theme:/ }).click()
      await expect(html).toHaveAttribute('data-theme', theme)
      colors.add((await meta.getAttribute('content')) ?? '')
      if (!expects2D(info)) await expect(page.locator('canvas')).toHaveCount(1)
    }
    expect(colors.size).toBe(3)
  })

  test('?mode=2d on desktop shows the map instead of the scene', async ({ page }, info) => {
    test.skip(expects2D(info), 'desktop only')
    await openSite(page, { mode: '2d' })
    await expect(page.locator('.app')).toHaveClass(/app--2d/)
    await expect(page.locator('.static-map img')).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(0)
  })
})
