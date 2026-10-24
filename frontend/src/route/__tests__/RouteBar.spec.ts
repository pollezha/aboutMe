import { beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createAppI18n } from '../../locale'
import RouteBar from '../RouteBar.vue'
import { useRouteStore } from '../useRouteStore'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function mountBar() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(RouteBar, {
    props: { themeLabel: 'Theme: day' },
    global: { plugins: [pinia, createAppI18n()] },
  })
  return { wrapper, route: useRouteStore() }
}

/** Остановка по номеру в баре: у посещённой вместо номера галочка. */
function barStop(wrapper: VueWrapper, index: string) {
  const found = wrapper.findAll('.route-stop')[Number(index) - 1]
  if (!found) throw new Error(`no bar stop ${index}`)
  return found
}

function button(wrapper: VueWrapper, text: string) {
  const found = wrapper.findAll('button').find((b) => b.text() === text)
  if (!found) throw new Error(`no button ${text}`)
  return found
}

describe('RouteBar', () => {
  it('marks the active stop active and a visited inactive stop visited', async () => {
    const { wrapper, route } = mountBar()

    route.openChapter('timepath')
    route.openChapter('profile')
    await nextTick()

    expect(barStop(wrapper, '01').classes()).toContain('route-stop--active')
    expect(barStop(wrapper, '03').classes()).toContain('route-stop--visited')
    expect(barStop(wrapper, '02').classes()).toContain('route-stop--default')
  })

  it('opens the chapter of a clicked stop and the contact and monitoring windows', async () => {
    const { wrapper, route } = mountBar()

    await barStop(wrapper, '05').trigger('click')
    expect(route.openWindow).toBe('education')

    await button(wrapper, 'Contact').trigger('click')
    expect(route.openWindow).toBe('contact')

    await button(wrapper, 'Monitoring').trigger('click')
    expect(route.openWindow).toBe('monitoring')
  })

  it('labels the bar from i18n and passes the theme toggle outward', async () => {
    const { wrapper } = mountBar()

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Chapters')
    expect(wrapper.text()).toContain('Yakov Polezhaev')

    await wrapper.get('[aria-label="Theme: day"]').trigger('click')
    expect(wrapper.emitted('toggleTheme')).toHaveLength(1)
  })
})
