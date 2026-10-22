import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ChapterWindow from '../ChapterWindow.vue'
import windowSource from '../ChapterWindow.vue?raw'

// jsdom не реализует showModal()/close() у <dialog>: минимальная подмена (атрибут open) — допустимо.
const proto = HTMLDialogElement.prototype
const original = { showModal: proto.showModal, close: proto.close }

beforeEach(() => {
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  proto.showModal = original.showModal
  proto.close = original.close
})

const base = {
  chapter: 'prospace',
  number: '02',
  eyebrow: 'Exit 02 · Experience',
  title: 'ProSpace',
  subtitle: 'Backend developer, 2024 — now',
  open: true,
} as const

function mountWindow(props: Record<string, unknown> = {}) {
  wrapper = mount(ChapterWindow, {
    props: { ...base, ...props },
    slots: { default: '<p id="body">Body</p>', links: '<a href="#x">GitHub</a>' },
    attachTo: document.body,
  })
  return wrapper
}

function buttonWithText(w: VueWrapper, text: string) {
  return w.findAll('button').find((b) => b.text().includes(text))
}

describe('ChapterWindow', () => {
  it('renders eyebrow, title, subtitle, body and links', () => {
    const w = mountWindow()

    expect(w.text()).toContain('Exit 02 · Experience')
    expect(w.get('h2').text()).toBe('ProSpace')
    expect(w.text()).toContain('Backend developer, 2024 — now')
    expect(w.find('#body').exists()).toBe(true)
    expect(w.text()).toContain('GitHub')
  })

  it('labels the dialog by its title', () => {
    const w = mountWindow()
    const id = w.get('h2').attributes('id')

    expect(id).toBeTruthy()
    expect(w.get('dialog').attributes('aria-labelledby')).toBe(id)
  })

  it('points --chapter at the chapter colour variable', () => {
    const w = mountWindow()

    expect(w.html()).toContain('--chapter: var(--chapter-prospace)')
  })

  it('shows prev/next with chapter numbers and emits on click', async () => {
    const w = mountWindow({
      prev: { number: '01', title: 'Profile' },
      next: { number: '03', title: 'TimePath' },
    })

    const prev = buttonWithText(w, '← 01 Profile')
    const next = buttonWithText(w, 'Next: 03 TimePath')
    expect(prev).toBeDefined()
    expect(next).toBeDefined()

    await prev?.trigger('click')
    await next?.trigger('click')

    expect(w.emitted('prev')).toHaveLength(1)
    expect(w.emitted('next')).toHaveLength(1)
  })

  it('omits the prev button without prev', () => {
    const w = mountWindow({ next: { number: '03', title: 'TimePath' } })

    expect(buttonWithText(w, '←')).toBeUndefined()
    expect(buttonWithText(w, 'Next:')).toBeDefined()
  })

  it('has a labelled close button that requests close', async () => {
    const w = mountWindow()

    await w.get('button[aria-label="Close"]').trigger('click')

    expect(w.emitted('update:open')).toEqual([[false]])
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('forwards Esc from the dialog as close', () => {
    const w = mountWindow()

    w.get('dialog').element.dispatchEvent(new Event('cancel', { cancelable: true }))

    expect(w.emitted('update:open')).toEqual([[false]])
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('goes full screen on mobile and respects reduced motion', () => {
    expect(windowSource).toMatch(/@media \(max-width: 767px\)/)
    expect(windowSource).toContain('prefers-reduced-motion')
  })
})
