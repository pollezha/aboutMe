import { describe, expect, it, vi } from 'vitest'
import { mountApp, useAppTestEnv } from '../../app/__tests__/mountApp'

vi.mock('../../scene/Scene.vue', () => import('../../app/__tests__/sceneStub'))
// Даты в окнах считаются от времени сборки (content/buildTime.ts) — фиксируем его.
vi.mock('../../content/buildTime', () => ({ BUILD_TIME: new Date(2026, 9, 23) }))
vi.mock('../../scene', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../scene')>()
  return { ...original, loadScene: vi.fn(original.loadScene) }
})

useAppTestEnv()

describe('App', () => {
  it('cycles the theme from the bar, sets data-theme and remembers it', async () => {
    const { wrapper } = mountApp()
    expect(document.documentElement.dataset.theme).toBe('day')

    await wrapper.get('.bottom-bar__actions button[aria-label^="Theme"]').trigger('click')

    expect(document.documentElement.dataset.theme).toBe('evening')
    expect(wrapper.get('.app').attributes('data-theme')).toBe('evening')
    expect(localStorage.getItem('aboutme.theme')).toBe('evening')
  })

  it('lets ?theme= override the saved theme', () => {
    localStorage.setItem('aboutme.theme', 'evening')
    history.replaceState(null, '', '/?theme=night')

    mountApp()

    expect(document.documentElement.dataset.theme).toBe('night')
    expect(localStorage.getItem('aboutme.theme')).toBe('evening')
  })

  it('does not remember a theme that came from ?theme=', () => {
    history.replaceState(null, '', '/?theme=night')

    mountApp()

    expect(localStorage.getItem('aboutme.theme')).toBeNull()
  })
})
