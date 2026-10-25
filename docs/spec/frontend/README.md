# Спеки модулей фронтенда

Живые спеки: по файлу на модуль (`src/<module>/`) или крупный элемент внутри него (например, `scene-buildings.md`).
Задача, которая меняет модуль, обновляет его спеку **в том же коммите**. Агент читает спеку модуля вместо
исходников всего модуля — поэтому туда пишется то, что не видно из кода и что придётся учитывать дальше.

Шаблон — `_template.md`. Имя файла = имя модуля из `frontend/scripts/module-graph.mjs` (`shared-ui.md` для `shared/ui`).

| Модуль | Спека | Эталон в Figma |
|---|---|---|
| app (оболочка, раскладка, TopBar) | `app.md` | Screens 33:2, 33:246, 34:709, 98:4223 |
| hero | `hero.md` | Hero/FirstScreen 21:465 |
| route (бар, остановки) | `route.md` | BottomBar 19:450, Route/Stop 15:180 |
| windows (каркас окна, история) | `windows.md` | Window/Shell 23:498 |
| chapters (8 окон) | `chapters.md` | Windows 28:276 … 31:1731 |
| scene (3D-остров) | `scene.md` | Screen/Desktop 33:2 (остров — концепт-арт, эталон уточняется) |
| fallback2d (2D-карта) | `fallback2d.md` | Phone 98:4223, Tablet 34:709 |
| mode, theme, locale, content, shared/* | `<module>.md` | Foundations 6:115, Components 6:116 |

Спеки заводятся при первой задаче, которая трогает модуль после 2026-10-25.
