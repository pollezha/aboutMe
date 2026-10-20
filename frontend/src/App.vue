<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLocaleSync } from './i18n'

useLocaleSync()
const { t } = useI18n()
</script>

<template>
  <header>
    <h1>{{ t('hero.name') }}</h1>
    <p>{{ t('hero.role') }}</p>
  </header>
</template>
