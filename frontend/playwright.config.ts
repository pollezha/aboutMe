import { existsSync } from 'node:fs'
import { chromium, defineConfig, devices } from '@playwright/test'

// E2E по собранному сайту (TC-01…TC-08, TC-11, AC1/AC3/AC4/AC6): `vite preview` поверх dist/ — тот же
// предрендер, что уходит на Cloudflare Pages. Порт свой (не 4173 у shots/lhci), чтобы не подхватить чужой сервер.
const PORT = 4174
const baseURL = `http://localhost:${PORT}`

// Chromium Playwright (`npx playwright install chromium`, CI); если он не скачан — системный Chrome.
const channel = existsSync(chromium.executablePath()) ? undefined : 'chrome'

const desktop = { ...devices['Desktop Chrome'], channel, viewport: { width: 1280, height: 720 } }

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  // Сцена в headless рисуется программно (SwiftShader, CPU): при большем числе воркеров она не успевает
  // за SCENE_TIMEOUT_MS и сайт честно уходит в 2D — 3D-проверки тогда не про то.
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    // Язык браузера — английский: boot-скрипт уводит RU-браузеры с `/` на `/ru/` (theme/boot.ts).
    locale: 'en-US',
    contextOptions: { reducedMotion: 'no-preference' },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-1280', use: desktop },
    {
      name: 'phone-390',
      // HTML без JS (seo) от вьюпорта не зависит — только на десктопе.
      testIgnore: ['seo.spec.ts'],
      use: {
        ...devices['Pixel 7'],
        channel,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      // AC6: без WebGL сайт сам переходит в 2D (shouldUse3D), без баннера ошибки.
      name: 'no-webgl',
      // Первый экран и axe — на 1280 и 390 (2D-раскладку axe проверяет на 390); здесь — режим и окна.
      testIgnore: ['first-screen.spec.ts', 'a11y.spec.ts', 'seo.spec.ts'],
      use: { ...desktop, launchOptions: { args: ['--disable-webgl', '--disable-webgl2'] } },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})
