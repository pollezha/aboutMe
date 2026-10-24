// Модуль shared/ui: базовые компоненты дизайн-системы (кнопки, иконки, диалог, плашки, карточка метрики).
// Может зависеть от shared/lib.
export { default as BaseButton } from './BaseButton.vue'
export { default as ChapterTag, type Chapter } from './ChapterTag.vue'
export { default as Dialog } from './Dialog.vue'
export { default as Icon } from './Icon.vue'
export { default as IconButton } from './IconButton.vue'
export { default as MetricCard } from './MetricCard.vue'
export { default as StatusPill } from './StatusPill.vue'
export { ICON_NAMES, type IconName } from './icon-registry'
