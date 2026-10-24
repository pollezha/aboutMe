import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountApp, openDialog, useAppTestEnv, waitForHash } from '../app/__tests__/mountApp'

// three/WebGL в jsdom не рендерим: чанк сцены — заглушка, которая по флагу «рисует первый кадр».
vi.mock('../scene/Scene.vue', () => import('../app/__tests__/sceneStub'))
// Даты в окнах считаются от времени сборки (content/buildTime.ts) — фиксируем его.
vi.mock('../content/buildTime', () => ({ BUILD_TIME: new Date(2026, 9, 23) }))
vi.mock('../scene', async (importOriginal) => {
  const original = await importOriginal<typeof import('../scene')>()
  return { ...original, loadScene: vi.fn(original.loadScene) }
})

useAppTestEnv()

describe('App', () => {
  it('opens the ProSpace window right after a click on stop 02', async () => {
    const { wrapper, route } = mountApp()

    await wrapper.findAll('.route-stop')[1]!.trigger('click')

    const dialog = openDialog(wrapper)
    expect(dialog.exists()).toBe(true)
    expect(dialog.get('h2').text()).toBe('ProSpace · OptiTrack')
    expect(dialog.get('.window__eyebrow').text()).toMatch(/^Stop 2 of 6 · Waybill · Latest role · /)
    expect(route.activeStop).toBe('prospace')
    expect(wrapper.findAll('.route-stop')[1]!.attributes('aria-current')).toBe('step')
    expect(location.hash).toBe('#prospace')
  })

  it('walks the route with next/prev and has no prev on 01 and no next on 06', async () => {
    const { wrapper, route } = mountApp()

    route.openChapter('profile')
    await nextTick()
    expect(openDialog(wrapper).text()).not.toContain('←')
    await openDialog(wrapper).get('.window__nav button').trigger('click')
    expect(route.openWindow).toBe('prospace')

    route.openChapter('contact')
    await nextTick()
    const nav = openDialog(wrapper).findAll('.window__nav button')
    expect(nav).toHaveLength(1)
    expect(nav[0]!.text()).toContain('05')
  })

  it('shows only Close in the Monitoring window', async () => {
    const { wrapper } = mountApp()

    await wrapper.get('.bottom-bar__actions .btn--ghost').trigger('click')

    const dialog = openDialog(wrapper)
    expect(dialog.get('h2').text()).toBe('Monitoring')
    expect(dialog.find('.window__nav').exists()).toBe(false)
  })

  it('closing the window clears the hash', async () => {
    const { wrapper, route } = mountApp()
    route.openChapter('prospace')
    await nextTick()

    await openDialog(wrapper).get('button[aria-label="Close"]').trigger('click')
    await waitForHash('')

    expect(route.openWindow).toBeNull()
    expect(location.hash).toBe('')
  })

  it('pushes a history entry when a window opens and closes it on Back', async () => {
    const { wrapper, route } = mountApp()

    await wrapper.findAll('.route-stop')[1]!.trigger('click')
    expect(history.state?.chapter).toBe('prospace')
    expect(location.hash).toBe('#prospace')

    history.back()
    await waitForHash('')
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
    await nextTick()

    expect(route.openWindow).toBeNull()
    expect(openDialog(wrapper).exists()).toBe(false)
  })

  it('replaces the history entry on prev/next instead of stacking one per chapter', async () => {
    const { wrapper } = mountApp()
    await wrapper.findAll('.route-stop')[1]!.trigger('click')
    const length = history.length

    await openDialog(wrapper).get('.window__nav .btn--secondary').trigger('click')

    expect(location.hash).toBe('#timepath')
    expect(history.state?.chapter).toBe('timepath')
    expect(history.length).toBe(length)
  })

  it('closes the window when the hash is cleared', async () => {
    const { wrapper, route } = mountApp()
    route.openChapter('contact')
    await nextTick()

    location.hash = ''
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await nextTick()

    expect(route.openWindow).toBeNull()
    expect(openDialog(wrapper).exists()).toBe(false)
  })

  it('closes a deep-linked window without leaving the page', async () => {
    history.replaceState(null, '', '/#contact')
    const { wrapper, route } = mountApp()
    await flushPromises()
    const length = history.length

    await openDialog(wrapper).get('button[aria-label="Close"]').trigger('click')

    expect(route.openWindow).toBeNull()
    expect(location.hash).toBe('')
    expect(history.length).toBe(length)
  })

  it('moves focus to the new title on next (05 → 06) and on prev (02 → 01)', async () => {
    const { wrapper, route } = mountApp()

    route.openChapter('education')
    await nextTick()
    await openDialog(wrapper).get('.window__nav .btn--secondary').trigger('click')
    await flushPromises()
    expect(document.activeElement?.tagName).toBe('H2')
    expect(document.activeElement?.textContent).toBe('Next stop: your team.')

    route.openChapter('prospace')
    await flushPromises()
    await openDialog(wrapper).get('.window__nav .btn--ghost').trigger('click')
    await flushPromises()
    expect(document.activeElement?.tagName).toBe('H2')
    expect(document.activeElement?.textContent).toBe('Yakov Polezhaev')
    expect(openDialog(wrapper).text()).not.toContain('←')
  })

  it('opens the Contact window from the #contact deep link', async () => {
    history.replaceState(null, '', '/#contact')

    const { wrapper } = mountApp()
    await flushPromises()

    expect(openDialog(wrapper).get('h2').text()).toBe('Next stop: your team.')
  })

  it('opens the ProSpace window with its body, dates and proof links from the #prospace deep link', async () => {
    history.replaceState(null, '', '/#prospace')

    const { wrapper } = mountApp()
    await flushPromises()

    const dialog = openDialog(wrapper)
    expect(dialog.get('.window__eyebrow').text()).toBe(
      'Stop 2 of 6 · Waybill · Latest role · Jan – Oct 2026',
    )
    expect(dialog.get('.window__eyebrow .icon').attributes('aria-hidden')).toBe('true')
    expect(dialog.get('.window__subtitle').text()).toBe(
      'Backend Developer (.NET) · TMS for large cargo owners',
    )
    expect(dialog.findAll('.key-results > li')).toHaveLength(5)
    const proof = dialog.get('.window__links a')
    expect(proof.text()).toBe('prospace.tech')
    expect(proof.attributes('href')).toBe('https://prospace.tech')
  })

  it('shows windows outside the route without a Stop prefix', async () => {
    history.replaceState(null, '', '/#monitoring')

    const { wrapper } = mountApp()
    await flushPromises()

    expect(openDialog(wrapper).get('.window__eyebrow').text()).toBe('Monitoring · this site, live')
  })

  it('ignores an unknown hash', async () => {
    history.replaceState(null, '', '/#nope')

    const { wrapper } = mountApp()
    await flushPromises()

    expect(openDialog(wrapper).exists()).toBe(false)
  })
})
