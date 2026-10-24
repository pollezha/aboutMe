import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { contentFor } from '../../content/bundles'
import {
  mountApp,
  openDialog,
  setViewport,
  useAppTestEnv,
  waitFor,
} from '../../app/__tests__/mountApp'

vi.mock('../../scene/Scene.vue', () => import('../../app/__tests__/sceneStub'))
// Даты в окнах считаются от времени сборки (content/buildTime.ts) — фиксируем его.
vi.mock('../../content/buildTime', () => ({ BUILD_TIME: new Date(2026, 9, 23) }))
vi.mock('../../scene', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../scene')>()
  return { ...original, loadScene: vi.fn(original.loadScene) }
})

useAppTestEnv()

const ruContent = contentFor('ru')

describe('App', () => {
  it('shows name and role in English by default', () => {
    const { wrapper } = mountApp()

    const hero = wrapper.get('.hero')
    expect(hero.get('h1').text()).toBe('Yakov Polezhaev')
    expect(hero.text()).toContain('.NET Backend Developer')
  })

  it('switches the hero to Russian after lang.setLang("ru")', async () => {
    const { wrapper, lang } = mountApp()

    lang.setLang('ru')
    await nextTick()

    const hero = wrapper.get('.hero')
    expect(hero.text()).toContain('Яков Полежаев')
    expect(hero.text()).toContain('.NET backend-разработчик')
    expect(hero.text()).not.toContain('Yakov Polezhaev')
  })

  // TC-06: /ru/ — весь первый экран и окна на русском, из RU-бандла.
  it('renders the hero, the bar and windows from the Russian bundle on /ru/', async () => {
    history.replaceState(null, '', '/ru/#prospace')
    const { wrapper } = mountApp()
    await flushPromises()

    const hero = wrapper.get('.hero')
    expect(hero.text()).toContain(ruContent.profile.status)
    expect(hero.text()).toContain(ruContent.profile.workFormat)
    expect(hero.text()).toContain('Связаться')
    expect(hero.get('a.btn--secondary').attributes('href')).toBe('/cv/Yakov_Polezhaev_CV_RU.pdf')
    expect(hero.get('a.btn--secondary').text()).toBe('Резюме (PDF)')

    const bar = wrapper.get('nav.bottom-bar')
    expect(bar.attributes('aria-label')).toBe('Главы')
    expect(bar.findAll('.route-stop__title').map((title) => title.text())).toEqual([
      'Профиль',
      'ProSpace',
      'TimePath',
      'Стек',
      'Учёба',
      'Контакты',
    ])

    const dialog = openDialog(wrapper)
    expect(dialog.get('h2').text()).toBe(ruContent.chapters.prospace.title)
    expect(dialog.get('.window__eyebrow').text()).toBe(
      'Остановка 2 из 6 · Накладная · Текущее место · янв – окт 2026',
    )
    expect(dialog.text()).toContain('Далее: 03 TimePath')
    expect(dialog.find('button[aria-label="Закрыть"]').exists()).toBe(true)
    await waitFor(() => document.documentElement.lang === 'ru')
    expect(document.documentElement.lang).toBe('ru')
  })

  it('switches EN → RU from the bar button without a reload: content, URL and <html lang>', async () => {
    const { wrapper } = mountApp()
    await flushPromises()
    await waitFor(() => document.documentElement.lang === 'en')
    const hero = wrapper.get('.hero')
    expect(hero.text()).toContain('Open to work')

    await wrapper
      .get('nav.bottom-bar button[aria-label="Language: English. Switch to Russian"]')
      .trigger('click')
    await flushPromises()

    expect(location.pathname).toBe('/ru/')
    expect(wrapper.get('.hero').element).toBe(hero.element)
    expect(hero.text()).toContain(ruContent.profile.status)
    expect(wrapper.get('.route-stop__title').text()).toBe('Профиль')
    await waitFor(() => document.documentElement.lang === 'ru')
    expect(document.documentElement.lang).toBe('ru')
    expect(localStorage.getItem('aboutme.lang')).toBe('ru')
    expect(
      wrapper.find('button[aria-label="Язык: русский. Переключить на английский"]').exists(),
    ).toBe(true)
  })

  it('opens /ru/ in Russian without remembering it as the visitor’s choice', async () => {
    history.replaceState(null, '', '/ru/')
    const { wrapper, lang } = mountApp()
    await flushPromises()

    expect(lang.lang).toBe('ru')
    expect(wrapper.get('.hero').text()).toContain('Яков Полежаев')
    expect(localStorage.getItem('aboutme.lang')).toBeNull()
  })

  it('moves between / and /ru/ on a language switch without reloading, keeping the open chapter', async () => {
    history.replaceState(null, '', '/#prospace')
    const { wrapper, lang } = mountApp()
    await flushPromises()

    lang.setLang('ru')
    await flushPromises()
    expect(location.pathname).toBe('/ru/')
    expect(location.hash).toBe('#prospace')
    expect(openDialog(wrapper).exists()).toBe(true)

    lang.setLang('en')
    await flushPromises()
    expect(location.pathname).toBe('/')
    expect(localStorage.getItem('aboutme.lang')).toBe('en')
  })

  it('has a language button in the top bar of the stacked layout', () => {
    setViewport(768)
    const { wrapper } = mountApp()

    expect(
      wrapper.find('.top-bar button[aria-label="Language: English. Switch to Russian"]').exists(),
    ).toBe(true)
  })
})
