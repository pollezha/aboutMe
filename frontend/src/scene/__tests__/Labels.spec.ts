import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { useLangStore } from '../../locale'
import { useRouteStore } from '../../route'
import { stops } from '../layout'
import Labels from '../Labels.vue'

// cientos Html без WebGL-контекста не смонтировать: подмена отдаёт слот и запоминает позицию.
vi.mock('@tresjs/cientos', () => ({
  Html: defineComponent({
    props: { position: { type: Array, default: undefined } },
    setup(props, { slots }) {
      return () =>
        h(
          'div',
          { class: 'html-stub', 'data-position': JSON.stringify(props.position) },
          slots.default?.(),
        )
    },
  }),
}))

function mountLabels() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(Labels, { global: { plugins: [pinia] } })
  return { wrapper, route: useRouteStore(), lang: useLangStore() }
}

describe('Labels', () => {
  it('labels the six stops with number and name, out of the Tab order', () => {
    const { wrapper } = mountLabels()

    const buttons = wrapper.findAll('button')
    expect(buttons.map((b) => b.attributes('aria-label'))).toEqual([
      '01 Profile',
      '02 ProSpace',
      '03 TimePath',
      '04 Tech stack',
      '05 Education',
      '06 Contact',
    ])
    for (const button of buttons) {
      expect(button.attributes('tabindex')).toBe('-1')
      expect(button.attributes('type')).toBe('button')
    }
    expect(buttons[1]!.text()).toBe('ProSpace')
  })

  it('follows the interface language without a remount', async () => {
    const { wrapper, lang } = mountLabels()

    lang.syncLang('ru')
    await nextTick()

    const buttons = wrapper.findAll('button')
    expect(buttons[0]!.attributes('aria-label')).toBe('01 Профиль')
    expect(buttons[3]!.text()).toBe('Стек')
  })

  it('anchors each label in world space above the top of its building', () => {
    const { wrapper } = mountLabels()

    wrapper.findAll('.html-stub').forEach((stub, i) => {
      const [x, y, z] = JSON.parse(stub.attributes('data-position')!) as number[]
      const stop = stops[i]!
      const roof = Math.max(...stop.boxes.map((box) => box.position[1] + box.size[1] / 2))
      expect(y).toBeGreaterThan(roof)
      expect(x).toBeCloseTo(stop.label[0])
      expect(z).toBeCloseTo(stop.label[2])
    })
  })

  it('opens the chapter on click', async () => {
    const { wrapper, route } = mountLabels()

    await wrapper.findAll('button')[1]!.trigger('click')

    expect(route.openWindow).toBe('prospace')
  })
})
