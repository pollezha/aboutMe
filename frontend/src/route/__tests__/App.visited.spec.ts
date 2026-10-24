import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '../../app'
import { appPlugins } from '../../app/__tests__/appPlugins'

// Посещённые остановки в баре (решение 19 ревью): 2D-режим, WebGL нет — three не нужен.
const dialogProto = HTMLDialogElement.prototype
const originalDialog = { showModal: dialogProto.showModal, close: dialogProto.close }

let wrapper: VueWrapper | undefined

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  history.replaceState(null, '', '/')
  window.innerWidth = 1440
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  dialogProto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialogProto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  dialogProto.showModal = originalDialog.showModal
  dialogProto.close = originalDialog.close
})

async function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(App, { global: { plugins: appPlugins(pinia) }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

function barStop(w: VueWrapper, index: string) {
  // По порядку в баре: у посещённой остановки вместо номера галочка.
  const found = w.findAll('.bottom-bar .route-stop')[Number(index) - 1]
  if (!found) throw new Error(`no bar stop ${index}`)
  return found
}

describe('visited route stops in the bottom bar', () => {
  it('marks a stop visited after its window was opened and another stop became active', async () => {
    const w = await mountApp()

    await barStop(w, '03').trigger('click')
    expect(barStop(w, '03').classes()).toContain('route-stop--active')

    await barStop(w, '01').trigger('click')
    expect(barStop(w, '01').classes()).toContain('route-stop--active')
    expect(barStop(w, '03').classes()).toContain('route-stop--visited')
    expect(barStop(w, '03').find('.route-stop__check').exists()).toBe(true)
    expect(barStop(w, '02').classes()).toContain('route-stop--default')
  })

  it('restores visited stops from the session after a reload', async () => {
    sessionStorage.setItem('aboutme.visited', JSON.stringify(['prospace', 'contact']))

    const w = await mountApp()

    expect(barStop(w, '02').classes()).toContain('route-stop--visited')
    expect(barStop(w, '06').classes()).toContain('route-stop--visited')
    expect(barStop(w, '01').classes()).toContain('route-stop--default')
  })
})
