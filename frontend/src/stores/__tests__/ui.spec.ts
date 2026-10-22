import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '../ui'

function freshStore() {
  setActivePinia(createPinia())
  return useUiStore()
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('ui store', () => {
  it('starts with day theme, English, 3D, motion on and nothing open', () => {
    const ui = freshStore()

    expect(ui.theme).toBe('day')
    expect(ui.lang).toBe('en')
    expect(ui.mode).toBe('3d')
    expect(ui.motionPaused).toBe(false)
    expect(ui.activeStop).toBeNull()
    expect(ui.openWindow).toBeNull()
  })

  it('cycles theme day → evening → night → day', () => {
    const ui = freshStore()

    ui.cycleTheme()
    expect(ui.theme).toBe('evening')
    ui.cycleTheme()
    expect(ui.theme).toBe('night')
    ui.cycleTheme()
    expect(ui.theme).toBe('day')
  })

  it('applyTheme puts the theme on <html data-theme>', () => {
    const ui = freshStore()

    ui.setTheme('night')
    ui.applyTheme()

    expect(document.documentElement.dataset.theme).toBe('night')
  })

  it('openChapter sets the active stop and the open window at once', () => {
    const ui = freshStore()

    ui.openChapter('prospace')

    expect(ui.activeStop).toBe('prospace')
    expect(ui.openWindow).toBe('prospace')
  })

  it('closeWindow keeps the active stop', () => {
    const ui = freshStore()
    ui.openChapter('contact')

    ui.closeWindow()

    expect(ui.openWindow).toBeNull()
    expect(ui.activeStop).toBe('contact')
  })

  it('persists theme, lang and motionPaused to localStorage', () => {
    const ui = freshStore()

    ui.setTheme('evening')
    ui.setLang('ru')
    ui.toggleMotion()

    expect(localStorage.getItem('aboutme.theme')).toBe('evening')
    expect(localStorage.getItem('aboutme.lang')).toBe('ru')
    expect(localStorage.getItem('aboutme.motionPaused')).toBe('true')
  })

  it('restores saved preferences and ignores invalid values', () => {
    localStorage.setItem('aboutme.theme', 'night')
    localStorage.setItem('aboutme.lang', 'de')
    localStorage.setItem('aboutme.motionPaused', 'true')

    const ui = freshStore()

    expect(ui.theme).toBe('night')
    expect(ui.lang).toBe('en')
    expect(ui.motionPaused).toBe(true)
  })

  it('survives a storage that throws', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota')
    }
    try {
      const ui = freshStore()
      expect(() => ui.setTheme('night')).not.toThrow()
      expect(ui.theme).toBe('night')
    } finally {
      Storage.prototype.setItem = original
    }
  })

  it('switches mode between 3d and 2d', () => {
    const ui = freshStore()

    ui.setMode('2d')

    expect(ui.mode).toBe('2d')
  })
})
