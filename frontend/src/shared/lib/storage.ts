// Хранилище может быть недоступно (приватный режим, квота, SSR) — тогда читаем null, запись молча теряется,
// настройки живут только в памяти.
type StorageName = 'localStorage' | 'sessionStorage'

function read(name: StorageName, key: string): string | null {
  try {
    return globalThis[name]?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(name: StorageName, key: string, value: string): void {
  try {
    globalThis[name]?.setItem(key, value)
  } catch {
    /* хранилище недоступно — не критично */
  }
}

export const load = (key: string) => read('localStorage', key)
export const save = (key: string, value: string) => write('localStorage', key, value)
export const loadSession = (key: string) => read('sessionStorage', key)
export const saveSession = (key: string, value: string) => write('sessionStorage', key, value)
