// Модуль locale: vue-i18n (сообщения EN/RU, подписи глав), маршруты /en и /ru, язык ↔ путь.
// Зависит от content и shared/lib. Пока реэкспорт из ../i18n, ../router.ts и типа Lang из стора (переезд — M11).
export * from '../i18n'
export * from '../router'
export type { Lang } from '../stores/ui'
