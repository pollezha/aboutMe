import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRouteStore } from '../useRouteStore'

function freshStore() {
  setActivePinia(createPinia())
  return useRouteStore()
}

beforeEach(() => {
  localStorage.clear()
})

describe('route store', () => {
  it('starts with motion on and nothing open', () => {
    const route = freshStore()

    expect(route.motionPaused).toBe(false)
    expect(route.activeStop).toBeNull()
    expect(route.openWindow).toBeNull()
  })

  it('openChapter sets the active stop and the open window at once', () => {
    const route = freshStore()

    route.openChapter('prospace')

    expect(route.activeStop).toBe('prospace')
    expect(route.openWindow).toBe('prospace')
  })

  it('closeWindow keeps the active stop', () => {
    const route = freshStore()
    route.openChapter('contact')

    route.closeWindow()

    expect(route.openWindow).toBeNull()
    expect(route.activeStop).toBe('contact')
  })

  it('persists motionPaused to localStorage', () => {
    const route = freshStore()

    route.toggleMotion()

    expect(localStorage.getItem('aboutme.motionPaused')).toBe('true')
  })

  it('restores the saved motion preference', () => {
    localStorage.setItem('aboutme.motionPaused', 'true')

    const route = freshStore()

    expect(route.motionPaused).toBe(true)
  })
})

describe('visited stops (sessionStorage, review decision 19)', () => {
  beforeEach(() => sessionStorage.clear())

  it('marks a route stop visited when its window opens and saves it for the session', () => {
    const route = freshStore()
    expect([...route.visitedStops]).toEqual([])

    route.openChapter('timepath')
    route.openChapter('profile')

    expect([...route.visitedStops].sort()).toEqual(['profile', 'timepath'])
    expect(JSON.parse(sessionStorage.getItem('aboutme.visited') ?? '[]').sort()).toEqual([
      'profile',
      'timepath',
    ])
  })

  it('does not count windows outside the route', () => {
    const route = freshStore()

    route.openChapter('summary')
    route.openChapter('monitoring')

    expect(route.visitedStops.size).toBe(0)
  })

  it('restores visited stops on reload and ignores junk', () => {
    sessionStorage.setItem('aboutme.visited', JSON.stringify(['contact', 'summary', 'nope', 7]))

    const route = freshStore()

    expect([...route.visitedStops]).toEqual(['contact'])
  })

  it('starts empty when the saved value is not JSON', () => {
    sessionStorage.setItem('aboutme.visited', '{oops')

    expect(freshStore().visitedStops.size).toBe(0)
  })
})
