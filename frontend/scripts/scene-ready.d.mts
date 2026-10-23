// Типы для scripts/scene-ready.mjs (тест scripts/__tests__/scene-ready.spec.ts).

export const SCENE_READY_BUDGET_MS: number

/** Медиана прогонов и вердикт; прогон без метки (null) — провал. */
export function verdict(
  runs: (number | null)[],
  budget?: number,
): { median: number | null; passed: boolean }
