import { defineComponent, h, onMounted } from 'vue'

/**
 * Подмена `scene/Scene.vue` для App-спеков: three/WebGL в jsdom не рендерим, заглушка по флагу
 * «рисует первый кадр». В спеке: `vi.mock('../scene/Scene.vue', () => import('../app/__tests__/sceneStub'))`.
 */
export const sceneStub = { drawsFirstFrame: false }

export default defineComponent({
  emits: ['ready'],
  setup(_, { emit }) {
    onMounted(() => {
      if (sceneStub.drawsFirstFrame) emit('ready')
    })
    return () => h('div', { class: 'scene-stub' })
  },
})
