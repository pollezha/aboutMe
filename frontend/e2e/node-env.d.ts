// Типы Node для playwright.config.ts без @types/node (новые зависимости не добавляем): только то, что
// конфиг реально использует.
declare const process: { env: Record<string, string | undefined> }

declare module 'node:fs' {
  export function existsSync(path: string): boolean
}
