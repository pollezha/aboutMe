import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { THEMES, WINDOWS, expectWindow, openDialog, openSite } from './support'

// TC-05 / NFR3: axe (WCAG 2.0 A/AA, 2.1 AA, 2.2 AA) на первом экране и в каждом из 8 окон, в 3 темах,
// на 1280 и 390 → 0 serious/critical. Остальное (moderate/minor) — в аннотации отчёта, не валит тест.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const BLOCKING = new Set(['serious', 'critical'])

// Без анимаций: окно появляется с opacity 0 → 1, и axe посчитал бы контраст полупрозрачного текста.
test.use({ contextOptions: { reducedMotion: 'reduce' } })

interface Finding {
  where: string
  rule: string
  impact: string
  targets: string[]
}

async function scan(page: Page, where: string, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(TAGS)
  if (include) builder = builder.include(include)
  const { violations } = await builder.analyze()
  return violations.map<Finding>((v) => ({
    where,
    rule: v.id,
    impact: v.impact ?? 'unknown',
    targets: v.nodes.map((node) => node.target.join(' ')),
  }))
}

for (const theme of THEMES) {
  test(`axe: first screen and all 8 windows (${theme})`, async ({ page }, info) => {
    // Девять прогонов axe рядом с программно рисуемой 3D-сценой — дольше стандартных 30 с.
    test.setTimeout(120_000)
    await openSite(page, { theme })
    const findings = await scan(page, 'first screen')

    for (const id of WINDOWS) {
      await page.evaluate((hash) => (window.location.hash = hash), id)
      await expectWindow(page, id)
      findings.push(...(await scan(page, `window ${id}`, 'dialog[open]')))
      await page.keyboard.press('Escape')
      await expect(openDialog(page)).toHaveCount(0)
    }

    const minor = findings.filter((f) => !BLOCKING.has(f.impact))
    for (const f of minor) {
      info.annotations.push({
        type: `axe ${f.impact}`,
        description: `${f.where}: ${f.rule} → ${f.targets.join(', ')}`,
      })
    }
    expect(findings.filter((f) => BLOCKING.has(f.impact))).toEqual([])
  })
}
