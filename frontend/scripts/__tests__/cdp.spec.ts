import { describe, expect, it } from 'vitest'
import { findChrome } from '../cdp.mjs'

/** Подмена fs.existsSync: «существуют» только перечисленные пути. */
const only =
  (...paths: string[]) =>
  (path: string) =>
    paths.includes(path)

describe('findChrome', () => {
  it('takes CHROME_PATH from the environment when the file exists', () => {
    const chrome = findChrome({
      env: { CHROME_PATH: 'D:/tools/chrome.exe' },
      platform: 'win32',
      exists: only('D:/tools/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'),
    })

    expect(chrome).toBe('D:/tools/chrome.exe')
  })

  it('does not fall back to a standard path when CHROME_PATH points nowhere', () => {
    const chrome = findChrome({
      env: { CHROME_PATH: 'D:/missing/chrome.exe' },
      platform: 'win32',
      exists: only('C:/Program Files/Google/Chrome/Application/chrome.exe'),
    })

    expect(chrome).toBeNull()
  })

  it('finds Chrome in the standard Windows locations without CHROME_PATH', () => {
    expect(
      findChrome({
        env: {},
        platform: 'win32',
        exists: only('C:/Program Files/Google/Chrome/Application/chrome.exe'),
      }),
    ).toBe('C:/Program Files/Google/Chrome/Application/chrome.exe')

    expect(
      findChrome({
        env: { LOCALAPPDATA: 'C:/Users/me/AppData/Local' },
        platform: 'win32',
        exists: only('C:/Users/me/AppData/Local/Google/Chrome/Application/chrome.exe'),
      }),
    ).toBe('C:/Users/me/AppData/Local/Google/Chrome/Application/chrome.exe')
  })

  it('finds Chrome or Chromium on Linux and macOS', () => {
    expect(findChrome({ env: {}, platform: 'linux', exists: only('/usr/bin/chromium') })).toBe(
      '/usr/bin/chromium',
    )
    expect(
      findChrome({
        env: {},
        platform: 'darwin',
        exists: only('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      }),
    ).toBe('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  })

  it('returns null when no browser is installed', () => {
    expect(findChrome({ env: {}, platform: 'linux', exists: only() })).toBeNull()
  })
})
