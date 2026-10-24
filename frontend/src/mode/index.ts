// Модуль mode: выбор 2D/3D, загрузка сцены и её состояния (заглушка, баннер), поворот карты.
// Зависит от scene (только index), locale, shared/*; сцена о mode не знает.
export * from '../scene'
export { default as SceneFallbackBanner } from './SceneFallbackBanner.vue'
export { default as SceneLoading } from './SceneLoading.vue'
export { detectWebGL2, shouldUse3D, type Use3DInput } from './shouldUse3D'
export { useModeStore, type Mode, type SceneState } from './useModeStore'
export { useViewMode } from './useViewMode'
