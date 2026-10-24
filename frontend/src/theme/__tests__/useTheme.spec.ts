import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { useTheme } from '../useTheme'
import { useThemeStore } from '../useThemeStore'

// Перевод-заглушка: ключ и параметры видны в подписи, модулю темы i18n не нужен.
const t = (key: string, named?: Record<string, unknown>) =>
  named ? `${key}(${Object.values(named).join(',')})` : key

function mountTheme() {
  let label = ''
  const Host = defineComponent({
    setup() {
      const theme = useTheme(t)
      return () => {
        label = theme.label.value
        return h('div')
      }
    },
  })
  mount(Host)
  return () => label
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  history.replaceState(null, '', '/')
  delete document.documentElement.dataset.theme
})

afterEach(() => history.replaceState(null, '', '/'))

describe('useTheme', () => {
  it('shows the ?theme= night without remembering it', () => {
    history.replaceState(null, '', '/?theme=night')

    mountTheme()

    expect(document.documentElement.dataset.theme).toBe('night')
    expect(localStorage.getItem('aboutme.theme')).toBeNull()
  })

  it('ignores an unknown ?theme= and keeps the saved theme', () => {
    localStorage.setItem('aboutme.theme', 'evening')
    history.replaceState(null, '', '/?theme=purple')

    mountTheme()

    expect(document.documentElement.dataset.theme).toBe('evening')
  })

  it('applies every theme change and names the current and the next theme', async () => {
    const label = mountTheme()
    expect(label()).toBe('theme.label(theme.day,theme.evening)')

    useThemeStore().cycleTheme()
    await nextTick()

    expect(document.documentElement.dataset.theme).toBe('evening')
    expect(label()).toBe('theme.label(theme.evening,theme.night)')
  })
})
