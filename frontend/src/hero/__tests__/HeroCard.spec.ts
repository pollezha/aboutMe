import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import en from '../../../../content/en.json'
import { resolveHighlights, type ContentBundle } from '../../content'
import HeroCard from '../HeroCard.vue'

const content = en as ContentBundle
const highlights = resolveHighlights(content, new Date(2026, 9, 22))
const profile = {
  name: content.profile.name,
  role: content.profile.role,
  status: content.profile.status,
  workFormat: content.profile.workFormat,
  location: content.profile.locationShort,
}
const links = { cv: '/cv.pdf', telegram: 'https://t.me/poll_ezha' }

function mountHero(extra: Record<string, unknown> = {}) {
  const labels = { contactLabel: 'Contact', cvLabel: 'CV (PDF)', telegramLabel: 'Telegram' }
  return mount(HeroCard, { props: { profile, highlights, links, ...labels, ...extra } })
}

describe('HeroCard', () => {
  it('shows the name as the page heading in the compact display style', () => {
    const h1 = mountHero().get('h1')

    expect(h1.text()).toBe('Yakov Polezhaev')
    expect(h1.classes()).toContain('t-display-hero-sm')
  })

  it('shows role, status and a one-line meta: work format · short location', () => {
    const wrapper = mountHero()

    expect(wrapper.text()).toContain('.NET Backend Developer')
    expect(wrapper.text()).toContain('Open to work')
    const meta = wrapper.get('.hero__where')
    expect(meta.text()).toBe('Remote / relocation · Serbia · CET')
    expect(meta.classes()).toContain('t-body-small')
  })

  it('does not put years of experience into the role line', () => {
    const role = mountHero().get('.hero__role')

    expect(role.text()).toBe('.NET Backend Developer')
    expect(role.text()).not.toMatch(/\d/)
  })

  it.each(['desktop', 'laptop'] as const)('is a compact card on %s', (variant) => {
    expect(mountHero({ variant }).classes()).toContain('hero--compact')
  })

  it('renders the three metrics as one line of value + caption, not as cards', () => {
    const wrapper = mountHero()

    expect(wrapper.find('.metric').exists()).toBe(false)
    const items = wrapper.findAll('.hero__metric')
    expect(items).toHaveLength(3)
    const values = items.map((item) => item.get('.t-display-number-sm').text())
    expect(values).toEqual(highlights.map((metric) => metric.value))
    expect(values[0]).toBe('1000+')
    expect(values[2]).toBe('2+ yrs')
    expect(items[2]!.get('.t-label-tag-xs').text()).toBe('IN PRODUCTION')
  })

  it('shows no metrics and no Monitoring link on mobile', () => {
    const mobile = mountHero({ variant: 'mobile' })

    expect(mobile.find('.hero__metrics').exists()).toBe(false)
    expect(mobile.text()).not.toContain('1000+')
    expect(mobile.text()).not.toContain('Monitoring')
  })

  it('emits contact from the primary button', async () => {
    const wrapper = mountHero()

    await wrapper.get('button.btn--primary').trigger('click')

    expect(wrapper.emitted('contact')).toHaveLength(1)
  })

  it.each(['desktop', 'mobile'] as const)('links the CV as a secondary button on %s', (variant) => {
    const cv = mountHero({ variant }).get('a[href="/cv.pdf"]')

    expect(cv.text()).toContain('CV (PDF)')
    expect(cv.classes()).toContain('btn--secondary')
  })

  it('hides the CV button when there is no CV link', () => {
    const wrapper = mountHero({ links: { telegram: links.telegram } })

    expect(wrapper.text()).not.toContain('CV')
  })

  it.each(['desktop', 'mobile'] as const)(
    'links Telegram as a named icon link on %s, opened safely',
    (variant) => {
      const telegram = mountHero({ variant }).get('a[href="https://t.me/poll_ezha"]')

      expect(telegram.classes()).toContain('icon-btn')
      expect(telegram.attributes('aria-label')).toBe('Telegram')
      expect(telegram.text()).toBe('')
      expect(telegram.attributes('target')).toBe('_blank')
      expect(telegram.attributes('rel')).toContain('noopener')
    },
  )
})
