<script setup lang="ts">
import HeroCard from './HeroCard.vue'
import { useHero } from './useHero'

// Контейнер карточки: данные — из useHero, раскладка (variant) — от оболочки. Корень — HeroCard,
// поэтому class оболочки (`.app__hero`, селектор e2e) ложится на корень карточки.
defineProps<{ variant?: 'desktop' | 'laptop' | 'mobile' }>()
const emit = defineEmits<{ contact: [] }>()

const { profile, highlights, links, contactLabel, cvLabel, telegramLabel } = useHero()
</script>

<template>
  <HeroCard
    :variant="variant"
    :profile="profile"
    :highlights="highlights"
    :links="links"
    :contact-label="contactLabel"
    :cv-label="cvLabel"
    :telegram-label="telegramLabel"
    @contact="emit('contact')"
  />
</template>
