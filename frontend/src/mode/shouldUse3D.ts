// Выбор режима (design §4 «Загрузка», FR10): 3D-сцена только там, где она потянет; иначе 2D-карта.

import { MIN_3D_MEMORY_GB, MIN_3D_WIDTH } from '../scene'

export interface Use3DInput {
  /** Ширина окна, px. */
  width: number
  /** Есть контекст WebGL2 (см. detectWebGL2). */
  webgl: boolean
  /** navigator.deviceMemory, ГБ; undefined — браузер не сообщает (Safari, Firefox). */
  deviceMemory?: number
  /** Явный выбор пользователя; null — не выбирал. */
  userChoice?: '3d' | '2d' | null
}

export function shouldUse3D({ width, webgl, deviceMemory, userChoice }: Use3DInput): boolean {
  if (userChoice === '2d') return false
  if (width < MIN_3D_WIDTH) return false
  if (!webgl) return false
  if (deviceMemory !== undefined && deviceMemory < MIN_3D_MEMORY_GB) return false
  return true
}

export function detectWebGL2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null
  } catch {
    return false
  }
}
