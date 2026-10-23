# Патч CI этапа 3: Lighthouse CI и `scene_ready` (T12)

Агент не правит `.github/workflows/` (хук). Пользователь вставляет шаги в job `frontend` файла
`.github/workflows/ci.yml` — **после** `- run: npm run build` (size-limit с бюджетами main / сцена / шрифты уже
идёт в `postbuild`, отдельный шаг не нужен).

```yaml
      # Lighthouse CI (NFR2, T1/T4): mobile, `/` и `/ru/`, 3 прогона, медиана; пороги — frontend/lighthouserc.cjs.
      # Chrome на ubuntu-latest предустановлен, CHROME_PATH не нужен.
      - name: Lighthouse CI
        run: npm run test:lhci

      # 3D интерактивна < 4 с (NFR1, T2): метка scene_ready на 1280×720, Slow 4G + CPU 4×.
      - name: Scene ready budget
        run: npm run perf:scene

      - name: Upload Lighthouse reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: lighthouseci
          path: frontend/.lighthouseci
          if-no-files-found: ignore
```

Условие для зелёного SEO: canonical и hreflang должны быть абсолютными, иначе аудиты `canonical` и `hreflang`
проваливаются (SEO 0,83 вместо 1,0). `src/head.ts` берёт origin из `VITE_SITE_ORIGIN` — его нужно передать шагу
сборки (переменная репозитория появится с T13):

```yaml
      - run: npm run build
        env:
          VITE_SITE_ORIGIN: ${{ vars.SITE_ORIGIN }}
```

Замечания:
- `actions/upload-artifact` — версию сверить с остальными actions в workflow (там `checkout@v7`, `setup-node@v7`).
- Lighthouse на раннерах GitHub шумит (общие CPU): если `performance` колеблется вокруг 0,85, можно поднять
  `numberOfRuns` в `lighthouserc.cjs` до 5 — пороги не занижать.
- Отчёты остаются в артефакте (`upload.target: filesystem`), наружу (temporary-public-storage) ничего не уходит.
