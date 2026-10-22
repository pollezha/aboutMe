import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusPill from '../StatusPill.vue'

describe('StatusPill', () => {
  it('renders slot text', () => {
    const wrapper = mount(StatusPill, { slots: { default: 'Open to work' } })

    expect(wrapper.text()).toContain('Open to work')
  })
})
