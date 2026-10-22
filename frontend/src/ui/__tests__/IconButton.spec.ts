import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import IconButton from '../IconButton.vue'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('IconButton', () => {
  it('uses label as aria-label and renders the icon', () => {
    const wrapper = mount(IconButton, { props: { icon: 'close', label: 'Close window' } })

    const button = wrapper.get('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-label')).toBe('Close window')
    expect(button.find('svg').exists()).toBe(true)
  })

  it('reports an error and has no aria-label when label is missing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const wrapper = mount(IconButton, { props: { icon: 'close' } as never })

    expect(error).toHaveBeenCalled()
    expect(wrapper.get('button').attributes('aria-label')).toBeUndefined()
  })

  it('exposes pressed state via aria-pressed', () => {
    const wrapper = mount(IconButton, { props: { icon: 'theme', label: 'Theme', pressed: true } })

    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
  })

  it('omits aria-pressed when not a toggle', () => {
    const wrapper = mount(IconButton, { props: { icon: 'lang', label: 'Language' } })

    expect(wrapper.get('button').attributes('aria-pressed')).toBeUndefined()
  })
})
