// Модуль shared/ui: базовые компоненты дизайн-системы (кнопки, иконки, диалог, плашки, карточка метрики).
// Может зависеть от shared/lib; компоненты пока лежат в ui/ (переезд — M7).
export { default as BaseButton } from '../../ui/BaseButton.vue'
export { default as ChapterTag, type Chapter } from '../../ui/ChapterTag.vue'
export { default as Dialog } from '../../ui/Dialog.vue'
export { default as Icon } from '../../ui/Icon.vue'
export { default as IconButton } from '../../ui/IconButton.vue'
export { default as MetricCard } from '../../ui/MetricCard.vue'
export { default as StatusPill } from '../../ui/StatusPill.vue'
export { ICON_NAMES, type IconName } from '../../ui/icon-registry'
