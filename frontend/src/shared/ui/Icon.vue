<script setup lang="ts">
import { computed } from 'vue'
import { iconSvg, type IconName } from './icon-registry'

defineOptions({ name: 'UiIcon' })

const props = defineProps<{ name: IconName; label?: string }>()

const svg = computed(() => iconSvg(props.name))
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- SVG из собственного репозитория (icons/*.svg), не пользовательский ввод -->
  <span
    class="icon"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    v-html="svg"
  ></span>
</template>

<style scoped>
.icon {
  display: inline-flex;
  flex: none;
  width: var(--icon-size, var(--space-6));
  height: var(--icon-size, var(--space-6));
  line-height: 0;
}

.icon :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
