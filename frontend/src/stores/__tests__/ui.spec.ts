import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '../ui'

function freshStore() {
  setActivePinia(createPinia())
  return useUiStore()
}

beforeEach(() => {
  localStorage.clear()
})

describe('ui store', () => {
  it('starts with 3D', () => {
    expect(freshStore().mode).toBe('3d')
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

  it('chooseMode sets the mode and remembers it for the next visit', () => {
    const ui = freshStore()

    ui.chooseMode('2d')
    expect(ui.mode).toBe('2d')
    expect(freshStore().userChoice).toBe('2d')

    const next = freshStore()
    next.chooseMode('3d')
    expect(next.mode).toBe('3d')
    expect(localStorage.getItem('aboutme.sceneChoice')).toBe('3d')
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
