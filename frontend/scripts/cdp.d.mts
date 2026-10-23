// Типы для scripts/cdp.mjs (тест scripts/__tests__/cdp.spec.ts под tsconfig.node).

export interface FindChromeOptions {
  env?: Record<string, string | undefined>
  platform?: string
  exists?: (path: string) => boolean
}

export function findChrome(options?: FindChromeOptions): string | null

export interface Page {
  send(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>
  once(method: string): Promise<Record<string, unknown>>
  setViewport(viewport: {
    width: number
    height: number
    deviceScaleFactor?: number
    mobile?: boolean
  }): Promise<unknown>
  emulateMedia(options?: {
    media?: string
    features?: { name: string; value: string }[]
  }): Promise<unknown>
  navigate(url: string): Promise<void>
  setContent(html: string): Promise<void>
  evaluate(expression: string): Promise<unknown>
  screenshot(options?: Record<string, unknown>): Promise<Uint8Array>
  pdf(options?: Record<string, unknown>): Promise<Uint8Array>
  close(): Promise<void>
}

export interface Browser {
  newPage(): Promise<Page>
  withPage<T>(work: (page: Page) => Promise<T>): Promise<T>
  close(): Promise<void>
}

export function launchChrome(options?: {
  windowSize?: [number, number]
  args?: string[]
  prefix?: string
}): Promise<Browser>
