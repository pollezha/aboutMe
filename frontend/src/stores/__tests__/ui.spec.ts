import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { palette } from '../../theme/palette'
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

  it('starts without a scene choice and with the scene idle', () => {
    const ui = freshStore()

    expect(ui.userChoice).toBeNull()
    expect(ui.sceneState).toBe('idle')
  })

  it('continueWithout3D switches to 2D and remembers the choice', () => {
    const ui = freshStore()
    ui.setSceneState('loading')

    ui.continueWithout3D()

    expect(ui.userChoice).toBe('2d')
    expect(ui.mode).toBe('2d')
    expect(ui.sceneState).toBe('idle')
    expect(localStorage.getItem('aboutme.sceneChoice')).toBe('2d')
    expect(freshStore().userChoice).toBe('2d')
  })

  it('ignores an unknown saved scene choice', () => {
    localStorage.setItem('aboutme.sceneChoice', 'vr')

    expect(freshStore().userChoice).toBeNull()
  })

  it('sceneTimedOut falls back to 2D without remembering it as a choice', () => {
    const ui = freshStore()
    ui.setSceneState('loading')

    ui.sceneTimedOut()

    expect(ui.mode).toBe('2d')
    expect(ui.sceneState).toBe('failed')
    expect(ui.userChoice).toBeNull()
    expect(localStorage.getItem('aboutme.sceneChoice')).toBeNull()
  })
})
