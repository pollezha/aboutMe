import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useRouteStore } from '../../route'
import { useWindowHistory } from '../useWindowHistory'

let wrapper: VueWrapper | undefined
let onWindowOpen!: (open: boolean) => void

function mountHistory() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const Host = defineComponent({
    setup() {
      onWindowOpen = useWindowHistory().onWindowOpen
      return () => null
    },
  })
  wrapper = mount(Host, { global: { plugins: [pinia] } })
  return useRouteStore()
}

/** jsdom выполняет history.back() асинхронно. */
async function waitForHash(hash: string) {
  for (let i = 0; i < 50 && location.hash !== hash; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

beforeEach(() => {
  history.replaceState(null, '', '/')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('useWindowHistory', () => {
  it('pushes one history entry on open and replaces it on prev/next', async () => {
    const route = mountHistory()
    const start = history.length

    route.openChapter('prospace')
    await nextTick()
    expect(location.hash).toBe('#prospace')
    expect(history.length).toBe(start + 1)

    route.openChapter('timepath')
    await nextTick()
    route.openChapter('techstack')
    await nextTick()
    expect(location.hash).toBe('#techstack')
    expect(history.length).toBe(start + 1)
    expect(history.state).toEqual({ chapter: 'techstack' })
  })

  it('closing an own entry goes back to the page without a hash', async () => {
    const route = mountHistory()
    route.openChapter('prospace')
    await nextTick()

    onWindowOpen(false)
    await waitForHash('')

    expect(route.openWindow).toBeNull()
    expect(location.hash).toBe('')
  })

  it('opens the window from a deep link at start and only drops the hash on close', async () => {
    history.replaceState(null, '', '/#contact')
    const route = mountHistory()
    const start = history.length
    expect(route.openWindow).toBe('contact')
    await nextTick()

    onWindowOpen(false)
    await nextTick()

    expect(location.hash).toBe('')
    expect(history.length).toBe(start)
  })

  it('follows hashchange: a chapter hash opens, a foreign hash closes', () => {
    const route = mountHistory()

    history.replaceState(null, '', '/#summary')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(route.openWindow).toBe('summary')

    history.replaceState(null, '', '/#nope')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(route.openWindow).toBeNull()
  })
})
