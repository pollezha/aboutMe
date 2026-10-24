import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLangStore } from '../useLangStore'

function freshStore() {
  setActivePinia(createPinia())
  return useLangStore()
}

beforeEach(() => {
  localStorage.clear()
})

describe('lang store', () => {
  it('starts with English', () => {
    expect(freshStore().lang).toBe('en')
  })

  it('persists the visitor’s choice to localStorage', () => {
    const store = freshStore()

    store.setLang('ru')

    expect(store.lang).toBe('ru')
    expect(localStorage.getItem('aboutme.lang')).toBe('ru')
  })

  it('restores the saved language and ignores an invalid one', () => {
    localStorage.setItem('aboutme.lang', 'ru')
    expect(freshStore().lang).toBe('ru')

    localStorage.setItem('aboutme.lang', 'de')
    expect(freshStore().lang).toBe('en')
  })

  it('syncLang follows the route without remembering it', () => {
    const store = freshStore()

    store.syncLang('ru')

    expect(store.lang).toBe('ru')
    expect(localStorage.getItem('aboutme.lang')).toBeNull()
  })

  it('toggleLang switches between English and Russian and remembers it', () => {
    const store = freshStore()

    store.toggleLang()
    expect(store.lang).toBe('ru')
    store.toggleLang()
    expect(store.lang).toBe('en')
    expect(localStorage.getItem('aboutme.lang')).toBe('en')
  })
})
