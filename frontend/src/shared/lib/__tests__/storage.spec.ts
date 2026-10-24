import { afterEach, describe, expect, it, vi } from 'vitest'
import { load, loadSession, save, saveSession } from '../storage'

// Хранилище браузера может отсутствовать (SSR) или бросать (приватный режим, квота, запрет cookies):
// настройки тогда живут только в памяти, сайт не падает.
const throwing = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('storage', () => {
  it('round-trips a value through localStorage and sessionStorage', () => {
    save('k', 'v')
    saveSession('s', 'w')
    expect(load('k')).toBe('v')
    expect(loadSession('s')).toBe('w')
    expect(load('missing')).toBeNull()
  })

  it('returns null without throwing when the storage throws', () => {
    vi.stubGlobal('localStorage', throwing)
    vi.stubGlobal('sessionStorage', throwing)
    expect(() => save('k', 'v')).not.toThrow()
    expect(() => saveSession('k', 'v')).not.toThrow()
    expect(load('k')).toBeNull()
    expect(loadSession('k')).toBeNull()
  })

  it('returns null without throwing when there is no storage at all (SSR)', () => {
    vi.stubGlobal('localStorage', undefined)
    vi.stubGlobal('sessionStorage', undefined)
    expect(() => save('k', 'v')).not.toThrow()
    expect(() => saveSession('k', 'v')).not.toThrow()
    expect(load('k')).toBeNull()
    expect(loadSession('k')).toBeNull()
  })
})
