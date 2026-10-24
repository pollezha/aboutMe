<script setup lang="ts">
// Слой 3D-сцены под HTML-слоем (design §4 «Загрузка»): ленивая сцена, заглушка цвета неба до первого кадра
// и карточка загрузки с выходом в 2D. Загрузку ведёт useSceneLoader; баннер сбоя показывает App.
import { onMounted } from 'vue'
import SceneLoading from './SceneLoading.vue'
import { useModeStore } from './useModeStore'
import { useSceneLoader } from './useSceneLoader'

/** shot — кадр острова для 2D-карты (?shot=island): только сцена, без заглушки и карточки. */
const props = defineProps<{ shot?: boolean }>()

const store = useModeStore()
const { component: sceneComponent, start, ready, continueWithout3D } = useSceneLoader()

onMounted(start)
</script>

<template>
  <div v-if="store.mode === '3d' && sceneComponent" class="scene-layer">
    <component :is="sceneComponent" :framing="props.shot ? 'island' : 'overlay'" @ready="ready" />
  </div>
  <!-- Заглушка под сценой: плавно уходит, когда сцена нарисовала первый кадр. -->
  <Transition name="scene-fade">
    <div
      v-if="!props.shot && store.mode === '3d' && store.sceneState !== 'ready'"
      class="scene-placeholder"
      aria-hidden="true"
    />
  </Transition>
  <SceneLoading
    v-if="!props.shot && store.mode === '3d' && store.sceneState === 'loading'"
    class="app__scene-loading"
    @skip="continueWithout3D"
  />
</template>

<style scoped>
/* Сцена и заглушка под HTML-слоем; заглушка (небо темы) уходит после первого кадра сцены. */
.scene-layer,
.scene-placeholder {
  position: fixed;
  inset: 0;
}

.scene-placeholder {
  background: var(--scene-sky);
}

.scene-fade-leave-active {
  transition: opacity 0.4s ease;
}

.scene-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .scene-fade-leave-active {
    transition: none;
  }
}

/* Figma LoadingCard 34:1119: справа внизу над баром, не над Hero. */
.app__scene-loading {
  position: fixed;
  right: var(--edge);
  bottom: calc(var(--size-bottom-bar) + var(--space-8));
  z-index: 2;
  max-width: calc(100vw - 2 * var(--edge));
}
</style>
