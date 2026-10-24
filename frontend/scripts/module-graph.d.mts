// Типы для scripts/module-graph.mjs (тест scripts/__tests__/layer-boundaries.spec.ts).
import type { Linter } from 'eslint'

export interface ModuleSpec {
  /** Модули, которые этот модуль может импортировать (ADR-0007). */
  deps: string[]
  /** Есть index.ts: снаружи модуль доступен только как `../<module>`. */
  facade: boolean
  /** Ленивый чанк: three/TresJS разрешены, import() — только в его index.ts. */
  lazy?: true
  /** Попадает в main-чанк и предрендер: import() запрещён. */
  prerendered?: true
  /** Файлы записи, если это не папка `src/<module>/` (корень src). */
  files?: string[]
  /** Исключения из фасада: { модуль: regex хвоста пути } (main.ts берёт CSS темы напрямую). */
  deepAllow?: Record<string, string>
}

export const MODULES: Record<string, ModuleSpec>

/** Записи конфигурации ESLint: по одной на модуль (плюс index ленивого модуля). */
export function moduleBoundaries(modules: Record<string, ModuleSpec>): Linter.Config[]

/** Первый найденный цикл как путь `a → … → a` или null. */
export function findCycle(modules: Record<string, ModuleSpec>): string[] | null

/** Папки `src/*` и `src/shared/*`, которых нет в графе. */
export function unregisteredFolders(
  modules: Record<string, ModuleSpec>,
  folders: string[],
): string[]
