<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CONTENT_LANGS, ROUTE, isChapterId } from '../content'
import { useChapterLabel } from '../locale'
import BottomBar, { type BottomBarStop } from './BottomBar.vue'
import { useRouteStore } from './useRouteStore'

// Нижний бар маршрута: остановки, профиль и подписи — отсюда; тема — снаружи (route не знает theme),
// поэтому подпись темы приходит пропом, а переключатели темы и языка уходят событиями.
defineProps<{
  /** Без значения — по ширине окна (см. BottomBar). */
  variant?: 'desktop' | 'compact'
  themeLabel: string
}>()

const emit = defineEmits<{ toggleTheme: []; toggleLang: [] }>()

const route = useRouteStore()
const { t } = useI18n()
const chapterLabel = useChapterLabel()

const profile = computed(() => ({ initials: 'YP', name: t('hero.name'), role: t('hero.role') }))
const stops = computed<BottomBarStop[]>(() =>
  ROUTE.map((chapter) => ({
    ...chapter,
    ...chapterLabel(chapter.id),
    // Активная важнее посещённой: у текущей главы — заливка, у уже просмотренных — галочка.
    state:
      route.activeStop === chapter.id
        ? 'active'
        : route.visitedStops.has(chapter.id)
          ? 'visited'
          : 'default',
  })),
)

// Кнопка языка — когда есть контент на обоих языках (FR8).
const showLang = CONTENT_LANGS.length > 1

function open(id: string) {
  if (isChapterId(id)) route.openChapter(id)
}
</script>

<template>
  <BottomBar
    :variant="variant"
    :stops="stops"
    :profile="profile"
    :nav-label="t('bar.nav')"
    :contact-label="t('bar.contact')"
    :monitoring-label="t('bar.monitoring')"
    :theme-label="themeLabel"
    :lang-label="t('lang.label')"
    :show-lang="showLang"
    @open="open"
    @contact="route.openChapter('contact')"
    @monitoring="route.openChapter('monitoring')"
    @toggle-theme="emit('toggleTheme')"
    @toggle-lang="emit('toggleLang')"
  />
</template>
