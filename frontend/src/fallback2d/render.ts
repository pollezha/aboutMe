// Рендер острова для 2D-карты (npm run island → public/img/island-<theme>.webp и @2x).
// Без импортов: модуль читают и StaticMap (main-чанк), и scripts/island.mjs (Node, type stripping).

/** Ширина 1x-рендера, px; @2x — вдвое больше. */
export const ISLAND_RENDER_WIDTH = 1200
/** Высота 1x-рендера: 1200 × 666 / 736 (рамка карты планшета, Figma 34:771), округлено. */
export const ISLAND_RENDER_HEIGHT = 1086

export function islandRenderUrl(theme: string, scale: 1 | 2 = 1): string {
  return `/img/island-${theme}${scale === 2 ? '@2x' : ''}.webp`
}
