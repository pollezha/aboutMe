import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useModeStore } from '../useModeStore'

function freshStore() {
  setActivePinia(createPinia())
  return useModeStore()
}

beforeEach(() => {
  localStorage.clear()
})

describe('mode store', () => {
  it('starts with 3D', () => {
    expect(freshStore().mode).toBe('3d')
  })

  it('switches mode between 3d and 2d', () => {
    const store = freshStore()

    store.setMode('2d')

    expect(store.mode).toBe('2d')
  })

  it('starts without a scene choice and with the scene idle', () => {
    const store = freshStore()

    expect(store.userChoice).toBeNull()
    expect(store.sceneState).toBe('idle')
  })

  it('continueWithout3D switches to 2D and remembers the choice', () => {
    const store = freshStore()
    store.setSceneState('loading')

    store.continueWithout3D()

    expect(store.userChoice).toBe('2d')
    expect(store.mode).toBe('2d')
    expect(store.sceneState).toBe('idle')
    expect(localStorage.getItem('aboutme.sceneChoice')).toBe('2d')
    expect(freshStore().userChoice).toBe('2d')
  })

  it('chooseMode sets the mode and remembers it for the next visit', () => {
    const store = freshStore()

    store.chooseMode('2d')
    expect(store.mode).toBe('2d')
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
    const store = freshStore()
    store.setSceneState('loading')

    store.sceneTimedOut()

    expect(store.mode).toBe('2d')
    expect(store.sceneState).toBe('failed')
    expect(store.userChoice).toBeNull()
    expect(localStorage.getItem('aboutme.sceneChoice')).toBeNull()
  })
})
