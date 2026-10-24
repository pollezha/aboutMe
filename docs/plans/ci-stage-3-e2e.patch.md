# Патч CI этапа 3 — раздел «Playwright» (T11)

Хук запрещает агенту править `.github/workflows/`, поэтому шаг вносит пользователь (или оркестратор сливает
его с разделом T12 в `ci-stage-3.patch.md`). Куда: `.github/workflows/ci.yml`, job `frontend`, после
шага `npm run build` (и после проверки `gen:theme`).

## Шаги

```yaml
      # E2E (T11): TC-01…TC-08, TC-11, AC1/AC3/AC4/AC6. Только chromium; системные библиотеки — --with-deps.
      # playwright.config.ts сам собирает сайт и поднимает `vite preview` на :4174 (webServer);
      # в CI reuseExistingServer выключен, workers = 2, retries = 1.
      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium

      - name: E2E (Playwright)
        run: npm run test:e2e

      - name: Upload Playwright report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            frontend/playwright-report/
            frontend/test-results/
            docs/design/e2e/
          retention-days: 14
```

## Заметки
- Версию `actions/upload-artifact` сверить с остальными action в `ci.yml` (там `checkout@v7`, `setup-node@v7`)
  и при необходимости поднять до актуальной мажорной.
- Кэш браузера (необязательно): `actions/cache` на `~/.cache/ms-playwright` с ключом по версии
  `@playwright/test` из `package-lock.json`; при попадании в кэш — `npx playwright install-deps chromium`.
- 3D-сцена в CI рисуется программно (SwiftShader). Если она не успевает за `SCENE_TIMEOUT_MS` (8 с), сайт
  уходит в 2D, и 3D-тесты desktop-1280 падают на ожидании `scene_ready` (это видно в отчёте) — тогда
  уменьшить `workers` в `playwright.config.ts` до 1 для CI.
- Скриншоты первого экрана (`docs/design/e2e/*.png`) в CI перезаписываются и уходят только в артефакт.
