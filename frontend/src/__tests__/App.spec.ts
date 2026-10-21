import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import App from '../App.vue'
import { createAppI18n } from '../i18n'
import { useUiStore } from '../stores/ui'

function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const i18n = createAppI18n()
  const wrapper = mount(App, { global: { plugins: [pinia, i18n] } })
  return { wrapper, ui: useUiStore() }
}

describe('App', () => {
  it('shows name and role in English by default', () => {
    const { wrapper } = mountApp()

    const header = wrapper.get('header')
    expect(header.text()).toContain('Yakov Polezhaev')
    expect(header.text()).toContain('.NET Backend Developer')
  })

  it('switches header to Russian after ui.setLang("ru")', async () => {
    const { wrapper, ui } = mountApp()

    ui.setLang('ru')
    await nextTick()

    const header = wrapper.get('header')
    expect(header.text()).toContain('Яков Полежаев')
    expect(header.text()).toContain('.NET backend-разработчик')
    expect(header.text()).not.toContain('Yakov Polezhaev')
  })

  it('sets <html lang> to en by default and to ru after ui.setLang("ru")', async () => {
    document.documentElement.lang = ''
    const { ui } = mountApp()

    expect(document.documentElement.lang).toBe('en')

    ui.setLang('ru')
    await nextTick()

    expect(document.documentElement.lang).toBe('ru')
  })
})
