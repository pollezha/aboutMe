import { expect, test } from '@playwright/test'
import en from '../../content/en.json' with { type: 'json' }
import { openSite, t } from './support'

// TC-01 / AC1: на 1280×720 и 390×844, в крайних темах (день, ночь) имя, роль, статус, Contact и CV
// видны сразу — без прокрутки и кликов. Кадры — в docs/design/e2e/<project>-<theme>.png.

// Без анимаций кадр стабилен: грузовик стоит, окна и заглушка сцены без переходов.
test.use({ contextOptions: { reducedMotion: 'reduce' } })

for (const theme of ['day', 'night'] as const) {
  test(`name, role, status, Contact and CV are visible without scrolling (${theme})`, async ({
    page,
  }, info) => {
    await openSite(page, { theme })
    const hero = page.locator('.app__hero')

    const visible = [
      hero.getByRole('heading', { level: 1, name: t.hero.name }),
      hero.getByText(t.hero.role, { exact: true }),
      hero.getByText(en.profile.status, { exact: true }),
      hero.getByRole('button', { name: t.hero.contact, exact: true }),
      hero.getByRole('link', { name: /CV/ }),
    ]
    for (const element of visible) await expect(element).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)).toBe(0)

    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    // testDir — frontend/e2e; кадры — в docs/design/e2e/ корня репозитория.
    const shots = `${info.project.testDir}/../../docs/design/e2e`
    await page.screenshot({ path: `${shots}/${info.project.name}-${theme}.png` })
  })
}
