import { describe, expect, it } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { BUILD_TIME, contentFor, resolveChapter } from '../../content'
import { WINDOWS } from '../../chapters'
import { createAppI18n } from '../../locale'
import { useRouteStore } from '../../route'
import { useChapterWindow } from '../useChapterWindow'

function chapterWindow() {
  const pinia = createPinia()
  setActivePinia(pinia)
  let result!: ReturnType<typeof useChapterWindow>
  const Host = defineComponent({
    setup() {
      result = useChapterWindow()
      return () => null
    },
  })
  mount(Host, { global: { plugins: [pinia, createAppI18n('en')] } })
  return { ...result, route: useRouteStore() }
}

describe('useChapterWindow', () => {
  it('is empty while no window is open', () => {
    expect(chapterWindow().view.value).toBeNull()
  })

  it('gives a route stop its "Stop N of 6" eyebrow, sign and neighbours', () => {
    const { view, route } = chapterWindow()
    route.openChapter('prospace')

    const text = resolveChapter(contentFor('en'), 'prospace', BUILD_TIME)
    expect(view.value).toMatchObject({
      id: 'prospace',
      number: '02',
      eyebrow: `Stop 2 of 6 · ${text.eyebrow}`,
      title: text.title,
      sign: WINDOWS.prospace.sign,
      prev: { id: 'profile', number: '01' },
      next: { id: 'timepath', number: '03' },
    })
  })

  it('keeps the plain eyebrow for a chapter off the route', () => {
    const { view, route } = chapterWindow()
    route.openChapter('monitoring')

    const text = resolveChapter(contentFor('en'), 'monitoring', BUILD_TIME)
    expect(view.value?.eyebrow).toBe(text.eyebrow)
  })

  it('goNext opens the next stop, goPrev on the first stop does nothing', async () => {
    const { view, route, goNext, goPrev } = chapterWindow()
    route.openChapter('profile')
    expect(view.value?.prev).toBeUndefined()

    goPrev()
    expect(route.openWindow).toBe('profile')
    goNext()
    await nextTick()
    expect(route.openWindow).toBe('prospace')
  })
})
