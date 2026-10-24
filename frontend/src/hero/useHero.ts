import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { BUILD_TIME, contentFor, resolveHighlights } from '../content'
import { useLangStore } from '../locale'
import type { HeroLinks, HeroMetric, HeroProfile } from './HeroCard.vue'

/**
 * Данные карточки Hero из контента текущего языка: имя и роль — i18n, статус и локация — профиль,
 * три метрики — `resolveHighlights` от времени сборки (предрендер и клиент показывают одно и то же),
 * ссылки CV и Telegram с подписями — из `profile.links`.
 */
export function useHero() {
  const langStore = useLangStore()
  const { t } = useI18n()
  const content = computed(() => contentFor(langStore.lang))

  const profile = computed<HeroProfile>(() => ({
    name: t('hero.name'),
    role: t('hero.role'),
    status: content.value.profile.status,
    workFormat: content.value.profile.workFormat,
    location: content.value.profile.locationShort,
  }))
  const highlights = computed<HeroMetric[]>(() => resolveHighlights(content.value, BUILD_TIME))

  const linkOf = (kind: 'cv' | 'telegram') =>
    computed(() => content.value.profile.links.find((link) => link.kind === kind))
  const cvLink = linkOf('cv')
  const telegramLink = linkOf('telegram')
  const links = computed<HeroLinks>(() => ({
    cv: cvLink.value?.href,
    telegram: telegramLink.value?.href,
  }))

  return {
    profile,
    highlights,
    links,
    contactLabel: computed(() => t('hero.contact')),
    cvLabel: computed(() => cvLink.value?.label ?? ''),
    telegramLabel: computed(() => telegramLink.value?.label ?? ''),
  }
}
