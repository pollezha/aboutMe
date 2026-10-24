import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { createWebHistory } from 'vue-router'
import { createAppI18n } from '../i18n'
import { createAppRouter } from '../routes'
import { useRouteLang } from '../useRouteLang'

let wrapper: VueWrapper | undefined

async function mountRouteLang() {
  let routeLang!: ReturnType<typeof useRouteLang>
  let locale = ''
  const Host = defineComponent({
    setup() {
      routeLang = useRouteLang()
      const i18n = useI18n({ useScope: 'global' })
      return () => {
        locale = i18n.locale.value
        return h('div')
      }
    },
  })
  const router = createAppRouter(createWebHistory())
  wrapper = mount(Host, { global: { plugins: [createPinia(), createAppI18n(), router] } })
  await router.isReady()
  await flushPromises()
  return { store: routeLang.store, locale: () => locale, element: wrapper.element }
}

beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  history.replaceState(null, '', '/')
})

describe('useRouteLang', () => {
  it('moves / to /ru/ on a language switch, keeping the open #contact, without a reload', async () => {
    history.replaceState(null, '', '/#contact')
    const historyLength = history.length
    const { store, locale, element } = await mountRouteLang()

    store.setLang('ru')
    await flushPromises()

    expect(location.pathname).toBe('/ru/')
    expect(location.hash).toBe('#contact')
    // Без перезагрузки: тот же корневой элемент, новая запись истории через pushState.
    expect(wrapper?.element).toBe(element)
    expect(history.length).toBe(historyLength + 1)
    expect(locale()).toBe('ru')
  })

  it('takes Russian from /ru/ without remembering it as the visitor’s choice', async () => {
    history.replaceState(null, '', '/ru/')

    const { store, locale } = await mountRouteLang()

    expect(store.lang).toBe('ru')
    expect(locale()).toBe('ru')
    expect(location.pathname).toBe('/ru/')
    expect(localStorage.getItem('aboutme.lang')).toBeNull()
  })

  it('follows the route back to / when the visitor goes back', async () => {
    history.replaceState(null, '', '/')
    const { store } = await mountRouteLang()
    store.setLang('ru')
    await flushPromises()

    history.back()
    for (let i = 0; i < 50 && location.pathname !== '/'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    await flushPromises()

    expect(location.pathname).toBe('/')
    expect(store.lang).toBe('en')
  })
})
