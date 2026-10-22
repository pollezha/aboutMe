import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BottomBar, { type BottomBarStop } from '../BottomBar.vue'

const stops: BottomBarStop[] = [
  { id: 'profile', index: '01', title: 'Profile', subtitle: 'About me', state: 'visited' },
  { id: 'prospace', index: '02', title: 'ProSpace', subtitle: 'Latest role', state: 'active' },
  { id: 'timepath', index: '03', title: 'TimePath', subtitle: 'Previous role', state: 'default' },
  { id: 'techstack', index: '04', title: 'Tech stack', subtitle: 'Skills', state: 'default' },
  { id: 'education', index: '05', title: 'Education', subtitle: 'BSc 2025', state: 'default' },
  { id: 'contact', index: '06', title: 'Contact', subtitle: 'Your team', state: 'default' },
]

const profile = { initials: 'YP', name: 'Yakov Polezhaev', role: '.NET Backend Developer' }

function mountBar(extra: Record<string, unknown> = {}) {
  return mount(BottomBar, { props: { stops, profile, ...extra } })
}

function stopButtons(wrapper: ReturnType<typeof mountBar>) {
  return wrapper.findAll<HTMLButtonElement>('.route-stop')
}

describe('BottomBar', () => {
  it('is a navigation landmark named Chapters', () => {
    const wrapper = mountBar()

    expect(wrapper.element.tagName).toBe('NAV')
    expect(wrapper.attributes('aria-label')).toBe('Chapters')
  })

  it('renders the six stops as buttons in route order', () => {
    const wrapper = mountBar()

    const buttons = stopButtons(wrapper)
    expect(buttons).toHaveLength(6)
    expect(buttons.every((b) => b.element.tagName === 'BUTTON')).toBe(true)
    expect(buttons.map((b) => b.text())).toEqual([
      expect.stringContaining('Profile'),
      expect.stringContaining('ProSpace'),
      expect.stringContaining('TimePath'),
      expect.stringContaining('Tech stack'),
      expect.stringContaining('Education'),
      expect.stringContaining('Contact'),
    ])
  })

  it('keeps every control reachable by Tab: stops first, then Contact, Monitoring, theme, language', () => {
    const wrapper = mountBar()

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(10)
    expect(
      buttons.every((b) => b.attributes('tabindex') !== '-1' && !b.attributes('disabled')),
    ).toBe(true)
    const names = buttons.slice(6).map((b) => b.attributes('aria-label') ?? b.text())
    expect(names).toEqual(['Contact', 'Monitoring', 'Dark theme', 'Language'])
  })

  it('emits open(id) synchronously when a stop is clicked', () => {
    const wrapper = mountBar()

    stopButtons(wrapper)[2]!.element.click()

    expect(wrapper.emitted('open')).toEqual([['timepath']])
  })

  it('marks the active stop with aria-current', () => {
    const wrapper = mountBar()

    expect(stopButtons(wrapper)[1]!.attributes('aria-current')).toBe('step')
  })

  it('emits contact, monitoring, toggleTheme and toggleLang from the actions', async () => {
    const wrapper = mountBar()
    const actions = wrapper.findAll('button').slice(6)

    for (const action of actions) await action.trigger('click')

    expect(wrapper.emitted('contact')).toHaveLength(1)
    expect(wrapper.emitted('monitoring')).toHaveLength(1)
    expect(wrapper.emitted('toggleTheme')).toHaveLength(1)
    expect(wrapper.emitted('toggleLang')).toHaveLength(1)
  })

  it('reflects the dark theme in aria-pressed on the theme toggle', () => {
    const wrapper = mountBar({ themePressed: true })

    expect(wrapper.get('button[aria-label="Dark theme"]').attributes('aria-pressed')).toBe('true')
  })

  it('shows the profile without years of experience', () => {
    const wrapper = mountBar()

    expect(wrapper.text()).toContain('YP')
    expect(wrapper.text()).toContain('Yakov Polezhaev')
    expect(wrapper.text()).toContain('.NET Backend Developer')
    expect(wrapper.text()).not.toMatch(/\byrs?\b/)
  })

  it('applies the compact variant', () => {
    expect(mountBar({ variant: 'compact' }).classes()).toContain('bottom-bar--compact')
    expect(mountBar({ variant: 'desktop' }).classes()).toContain('bottom-bar--desktop')
  })
})
