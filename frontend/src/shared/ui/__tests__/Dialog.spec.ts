import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h } from 'vue'
import Dialog from '../Dialog.vue'
import dialogSource from '../Dialog.vue?raw'

// jsdom не реализует showModal()/close() у <dialog>: подменяем их минимальной моделью
// (выставляют/снимают атрибут open). Это допустимо — проверяем поведение компонента, а не браузера.
const proto = HTMLDialogElement.prototype
const original = { showModal: proto.showModal, close: proto.close }
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute('open', '')
})
const close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute('open')
})

let wrapper: VueWrapper | undefined
let opener: HTMLButtonElement | undefined

beforeEach(() => {
  showModal.mockClear()
  close.mockClear()
  proto.showModal = showModal
  proto.close = close
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  opener?.remove()
  opener = undefined
  proto.showModal = original.showModal
  proto.close = original.close
})

function mountDialog(open: boolean, slot = () => h('button', { id: 'inside' }, 'Inside')) {
  wrapper = mount(Dialog, {
    props: { open, labelledBy: 'win-title' },
    slots: { default: slot },
    attachTo: document.body,
  })
  return wrapper
}

describe('Dialog', () => {
  it('opens as a modal when open becomes true', async () => {
    const w = mountDialog(false)
    expect(showModal).not.toHaveBeenCalled()

    await w.setProps({ open: true })

    expect(showModal).toHaveBeenCalledTimes(1)
    expect(w.get('dialog').element.open).toBe(true)
  })

  it('opens on mount with open=true and closes when open becomes false', async () => {
    const w = mountDialog(true)
    expect(showModal).toHaveBeenCalledTimes(1)

    await w.setProps({ open: false })

    expect(close).toHaveBeenCalledTimes(1)
    expect(w.get('dialog').element.open).toBe(false)
  })

  it('marks itself modal and labelled by the given id', () => {
    const dialog = mountDialog(true).get('dialog')

    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-labelledby')).toBe('win-title')
  })

  it('requests close on Esc (cancel event)', () => {
    const w = mountDialog(true)
    const cancel = new Event('cancel', { cancelable: true })

    w.get('dialog').element.dispatchEvent(cancel)

    expect(w.emitted('update:open')).toEqual([[false]])
    expect(w.emitted('close')).toHaveLength(1)
    expect(cancel.defaultPrevented).toBe(true)
  })

  it('closes on a backdrop click but not on a click inside', async () => {
    const w = mountDialog(true)

    await w.get('#inside').trigger('click')
    expect(w.emitted('update:open')).toBeUndefined()

    await w.get('dialog').trigger('pointerdown')
    await w.get('dialog').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('stays open when a drag starts inside and ends on the backdrop', async () => {
    const w = mountDialog(true)

    await w.get('#inside').trigger('pointerdown')
    await w.get('dialog').trigger('click')

    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('moves focus inside on open and returns it to the opener on close', async () => {
    opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const w = mountDialog(false)

    await w.setProps({ open: true })
    expect(document.activeElement).toBe(w.get('#inside').element)

    await w.setProps({ open: false })
    expect(document.activeElement).toBe(opener)
  })

  it('focuses the dialog itself when nothing inside is focusable', async () => {
    const w = mountDialog(false, () => h('p', 'Text only'))

    await w.setProps({ open: true })

    const dialog = w.get('dialog').element
    expect(dialog.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(dialog)
  })

  it('disables motion under prefers-reduced-motion', () => {
    expect(dialogSource).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*(transition|animation): none/,
    )
  })
})
