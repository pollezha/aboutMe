import { describe, expect, it, vi } from 'vitest'
import { mountApp, setViewport, useAppTestEnv } from '../app/__tests__/mountApp'

vi.mock('../scene/Scene.vue', () => import('../app/__tests__/sceneStub'))
// Даты в окнах считаются от времени сборки (content/buildTime.ts) — фиксируем его.
vi.mock('../content/buildTime', () => ({ BUILD_TIME: new Date(2026, 9, 23) }))
vi.mock('../scene', async (importOriginal) => {
  const original = await importOriginal<typeof import('../scene')>()
  return { ...original, loadScene: vi.fn(original.loadScene) }
})

useAppTestEnv()

describe('App', () => {
  it('renders the hero card and the chapters bar on desktop', () => {
    const { wrapper, ui } = mountApp()

    expect(ui.mode).toBe('3d')
    expect(wrapper.find('.hero--desktop').exists()).toBe(true)
    const bar = wrapper.get('nav[aria-label="Chapters"]')
    expect(bar.classes()).toContain('bottom-bar--desktop')
    expect(bar.findAll('.route-stop')).toHaveLength(6)
    expect(wrapper.find('.scene-placeholder').exists()).toBe(true)
  })

  it('uses the laptop hero and compact bar at 1280 px', () => {
    setViewport(1280)
    const { wrapper } = mountApp()

    expect(wrapper.find('.hero--laptop').exists()).toBe(true)
    expect(wrapper.get('nav[aria-label="Chapters"]').classes()).toContain('bottom-bar--compact')
  })

  it('stacks the hero over the scene on a tablet, with the theme toggle in the top bar', () => {
    setViewport(768)
    const { wrapper, ui } = mountApp()

    expect(ui.mode).toBe('3d')
    expect(wrapper.get('.app').classes()).toContain('app--stacked')
    expect(wrapper.get('.top-bar').text()).toContain('YP · .NET backend')
    const theme = wrapper.get('.top-bar button[aria-label^="Theme"]')
    expect(theme.attributes('aria-label')).toBe('Theme: day. Switch to evening')
    expect(theme.attributes('aria-pressed')).toBeUndefined()
    expect(wrapper.find('.top-bar button[aria-label="Pause animation"]').exists()).toBe(true)
    expect(wrapper.get('nav[aria-label="Chapters"]').classes()).toContain('bottom-bar--compact')
  })

  it('stacks TopBar → Hero → map → bar on a phone, without metrics or a Monitoring link', () => {
    setViewport(390)
    const { wrapper } = mountApp()

    const order = [...wrapper.get('.app').element.querySelectorAll('*')]
      .map((el) =>
        ['top-bar', 'hero', 'static-map', 'bottom-bar'].find((name) => el.classList.contains(name)),
      )
      .filter(Boolean)
    expect(order).toEqual(['top-bar', 'hero', 'static-map', 'bottom-bar'])

    const map = wrapper.get('.static-map').element
    const siblings = [...map.parentElement!.children].filter((el) => el !== map)
    expect(siblings.map((el) => el.textContent).join(' ')).not.toContain('Monitoring')
    expect(wrapper.get('.hero').text()).not.toContain('1000+')
  })

  it('shows the compact hero with CV from content on desktop', () => {
    const { wrapper } = mountApp()

    const hero = wrapper.get('.hero')
    expect(hero.classes()).toContain('hero--compact')
    expect(hero.get('a.btn--secondary').attributes('href')).toBe('/cv/Yakov_Polezhaev_CV_EN.pdf')
    expect(hero.find('a[aria-label="Telegram"]').exists()).toBe(true)
  })
})
