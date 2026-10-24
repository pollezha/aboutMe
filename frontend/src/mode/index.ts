// Модуль mode: выбор 2D/3D, загрузка сцены и её состояния (заглушка, баннер), поворот карты.
// Зависит от scene (только index), locale, shared/*. Пока реэкспорт SceneLoading/SceneFallbackBanner из ../ui
// (M9) и общего стора из ../stores (режется в M10–M13).
export * from '../scene'
export { default as SceneFallbackBanner } from '../ui/SceneFallbackBanner.vue'
export { default as SceneLoading } from '../ui/SceneLoading.vue'
export { isTheme, useUiStore, type Mode, type SceneState, type Theme } from '../stores/ui'
