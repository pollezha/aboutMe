// Lighthouse CI (T12; NFR1/NFR2, T1/T4 спеки): предрендеренные `/` и `/ru/` из dist/, мобильная эмуляция
// Lighthouse по умолчанию (Moto G Power, 4G-троттлинг, CPU 4×). Запуск: `npm run build && npm run test:lhci`.
// Метку `scene_ready` (< 4 с, T2) Lighthouse не ассертит — её меряет `npm run perf:scene`.
module.exports = {
  ci: {
    collect: {
      // LHCI сам поднимает статик-сервер на dist/; `/ru/` отдаётся как ru/index.html.
      staticDistDir: './dist',
      url: ['http://localhost/', 'http://localhost/ru/'],
      numberOfRuns: 3,
      // Не задан — chrome-launcher ищет Chrome сам (на ubuntu-latest он предустановлен).
      chromePath: process.env.CHROME_PATH || undefined,
      settings: {
        // Без preset — мобильный профиль; явный formFactor, чтобы не зависеть от умолчаний версии.
        formFactor: 'mobile',
        // Язык браузера фиксирован: boot-скрипт уводит русскую локаль с `/` на `/ru/` (так меряли бы /ru/ дважды).
        chromeFlags: '--headless=new --no-first-run --lang=en-US --accept-lang=en-US',
        // Скрипты, которые антивирус (Kaspersky) встраивает в страницы на машине разработчика: http и
        // render-blocking — локальный шум, в CI их нет.
        blockedUrlPatterns: ['*.kaspersky-labs.com'],
      },
    },
    assert: {
      // Медиана из numberOfRuns прогонов.
      aggregationMethod: 'median-run',
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        // warn: предрендер — в десктопной раскладке, на телефоне после гидрации раскладка перестраивается.
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      // Отчёты локально и артефактом CI; наружу ничего не уходит.
      target: 'filesystem',
      outputDir: './.lighthouseci/reports',
    },
  },
}
