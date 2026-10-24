import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useRouteStore } from '../../route'
import ProofLinks from '../ProofLinks.vue'

describe('ProofLinks', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('opens external links in a new tab with the external icon', () => {
    const wrapper = mount(ProofLinks, {
      props: {
        links: [{ label: 'GitHub pollezha', href: 'https://github.com/x', icon: 'external' }],
      },
    })

    const link = wrapper.get('a')
    expect(link.text()).toBe('GitHub pollezha')
    expect(link.attributes('href')).toBe('https://github.com/x')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
    expect(link.classes()).toContain('btn--ghost')
    expect(link.find('.icon').exists()).toBe(true)
  })

  it('marks a file link as a download in the same tab', () => {
    const wrapper = mount(ProofLinks, {
      props: { links: [{ label: 'Download CV', href: '/cv/cv.pdf', icon: 'download' }] },
    })

    const link = wrapper.get('a')
    expect(link.attributes('download')).toBeDefined()
    expect(link.attributes('target')).toBeUndefined()
  })

  it('opens another chapter window from a chapter link', async () => {
    const wrapper = mount(ProofLinks, {
      props: { links: [{ label: '30-second summary', chapter: 'summary' }] },
    })

    await wrapper.get('button').trigger('click')
    expect(useRouteStore().openWindow).toBe('summary')
  })
})
