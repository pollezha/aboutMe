// Модуль route: маршрут по главам — нижняя панель и её остановки.
// Зависит от content, locale, shared/*. Пока реэкспорт из ../ui (переезд — M9).
export {
  default as BottomBar,
  type BottomBarProfile,
  type BottomBarStop,
} from '../ui/BottomBar.vue'
export { default as RouteStop } from '../ui/RouteStop.vue'
