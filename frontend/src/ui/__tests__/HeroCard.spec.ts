import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import en from '../../../../content/en.json'
import { resolveHighlights } from '../../content/experience'
import type { ContentBundle } from '../../content/types'
import HeroCard from '../HeroCard.vue'
import MetricCard from '../MetricCard.vue'

const content = en as ContentBundle
const highlights = resolveHighlights(content, new Date(2026, 9, 22))
const profile = {
  name: content.profile.name,
  role: content.profile.role,
  status: content.profile.status,
  workFormat: content.profile.workFormat,
  location: content.profile.location,
}
const links = { cv: '/cv.pdf', telegram: 'https://t.me/poll_ezha' }

function mountHero(extra: Record<string, unknown> = {}) {
  return mount(HeroCard, { props: { profile, highlights, links, ...extra } })
}

describe('HeroCard', () => {
  it('shows the name as the page heading', () => {
    const h1 = mountHero().get('h1')

    expect(h1.text()).toBe('Yakov Polezhaev')
    expect(h1.classes()).toContain('t-display-hero')
  })

  it('shows role, status, work format and location without clicks', () => {
    const text = mountHero().text()

    expect(text).toContain('.NET Backend Developer')
    expect(text).toContain('Open to work')
    expect(text).toContain('Remote / relocation')
    expect(text).toContain('Based in Serbia · CET (UTC+1)')
  })

  it('does not put years of experience into the role line', () => {
    const role = mountHero().get('.hero__role')

    expect(role.text()).toBe('.NET Backend Developer')
    expect(role.text()).not.toMatch(/\d/)
  })

  it('renders the three metrics, the third computed from experience dates', () => {
    const cards = mountHero().findAllComponents(MetricCard)

    expect(cards).toHaveLength(3)
    expect(cards.every((card) => card.props('size') === 'sm')).toBe(true)
    expect(cards[0]!.text()).toContain('1000+')
    expect(cards[2]!.text()).toContain('IN PRODUCTION')
    expect(cards[2]!.text()).toContain('2+ yrs')
    expect(cards[2]!.text()).toContain('since July 2024')
  })

  it('emits contact from the primary button', async () => {
    const wrapper = mountHero()

    await wrapper.get('button.btn--primary').trigger('click')

    expect(wrapper.emitted('contact')).toHaveLength(1)
  })

  it('links CV and Telegram', () => {
    const wrapper = mountHero()

    expect(wrapper.get('a[href="/cv.pdf"]').text()).toContain('CV')
    expect(wrapper.find('a[href="https://t.me/poll_ezha"]').exists()).toBe(true)
  })

  it('styles CV and Telegram links as buttons and opens Telegram safely', () => {
    const wrapper = mountHero()

    expect(wrapper.get('a[href="/cv.pdf"]').classes()).toContain('btn--secondary')
    const telegram = wrapper.get('a[href="https://t.me/poll_ezha"]')
    expect(telegram.classes()).toContain('btn--ghost')
    expect(telegram.attributes('target')).toBe('_blank')
    expect(telegram.attributes('rel')).toContain('noopener')
  })

  it('shows Monitoring only on mobile and emits monitoring', async () => {
    expect(mountHero({ variant: 'desktop' }).find('.hero__monitoring').exists()).toBe(false)

    const mobile = mountHero({ variant: 'mobile' })
    const monitoring = mobile.get('button.hero__monitoring')
    await monitoring.trigger('click')

    expect(monitoring.text()).toContain('Monitoring')
    expect(mobile.emitted('monitoring')).toHaveLength(1)
  })

  it('names the icon-only Telegram link on mobile', () => {
    const link = mountHero({ variant: 'mobile' }).get('a[href="https://t.me/poll_ezha"]')

    expect(link.attributes('aria-label')).toBe('Telegram')
  })
})
