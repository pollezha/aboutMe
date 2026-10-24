import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { palette } from '../palette'
import { useThemeStore } from '../useThemeStore'

function freshStore() {
  setActivePinia(createPinia())
  return useThemeStore()
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('theme store', () => {
  it('starts with day theme', () => {
    const ui = freshStore()

    expect(ui.theme).toBe('day')
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

  it('applyTheme updates the theme-color meta and the color scheme', () => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.id = 'theme-color'
    meta.content = palette.day['bg/canvas']
    document.head.appendChild(meta)
    try {
      const ui = freshStore()

      ui.setTheme('night')
      ui.applyTheme()
      expect(meta.content).toBe(palette.night['bg/canvas'])
      expect(document.documentElement.style.colorScheme).toBe('dark')

      ui.setTheme('evening')
      ui.applyTheme()
      expect(meta.content).toBe(palette.evening['bg/canvas'])
      expect(document.documentElement.style.colorScheme).toBe('light')
    } finally {
      meta.remove()
    }
  })

  it('previewTheme switches the theme without remembering it', () => {
    const ui = freshStore()

    ui.previewTheme('night')

    expect(ui.theme).toBe('night')
    expect(localStorage.getItem('aboutme.theme')).toBeNull()
  })

  it('persists theme to localStorage', () => {
    const ui = freshStore()

    ui.setTheme('evening')

    expect(localStorage.getItem('aboutme.theme')).toBe('evening')
  })

  it('restores the saved theme and ignores invalid values', () => {
    localStorage.setItem('aboutme.theme', 'night')
    expect(freshStore().theme).toBe('night')

    localStorage.setItem('aboutme.theme', 'purple')
    expect(freshStore().theme).toBe('day')
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
})
