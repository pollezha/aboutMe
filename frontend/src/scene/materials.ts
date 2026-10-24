// Общие материалы сцены: один MeshLambertMaterial на цветовую роль, цвет — из palette текущей темы (TC-08).
// Смена темы перекрашивает те же материалы, а не создаёт новые: меньше программ и draw-call-ов.
import { MeshLambertMaterial } from 'three'
import { watchEffect } from 'vue'
import type { ChapterId } from '../content'
import type { palette } from '../theme'

export type ThemeColors = Record<keyof (typeof palette)['day'], string>

function channels(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const
}

/** Смесь двух цветов #RRGGBB: t = 0 → a, t = 1 → b. Результат в нижнем регистре. */
export function mixHex(a: string, b: string, t: number): string {
  const from = channels(a)
  const to = channels(b)
  return `#${from
    .map((channel, i) =>
      Math.round(channel + (to[i]! - channel) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/** Здание главы: стены — цвет главы, крыша и пристройки — он же, разбавленный поверхностью темы. */
export function buildingColors(colors: ThemeColors, id: ChapterId) {
  const chapter = colors[`chapter/${id}`]
  const surface = colors['bg/surface']
  return {
    wall: chapter.toLowerCase(),
    roof: mixHex(chapter, surface, 0.35),
    annex: mixHex(chapter, surface, 0.6),
  }
}

/** Цвета фоновых домиков — из scene/*: песчаные, светлые и серые кровли. */
export function houseColors(colors: ThemeColors): string[] {
  const surface = colors['bg/surface']
  return [
    mixHex(colors['scene/sand'], surface, 0.2),
    mixHex(colors['scene/sand'], colors['scene/road'], 0.25),
    mixHex(colors['scene/road'], surface, 0.55),
  ]
}

/** Грузовик: кабина — акцент темы, кузов — светлый песочный, рама — тёмная дорога. */
export function truckColors(colors: ThemeColors) {
  return {
    cab: colors['accent/primary'].toLowerCase(),
    cargo: mixHex(colors['bg/surface'], colors['scene/sand'], 0.2),
    chassis: mixHex(colors['scene/road'], colors['text/primary'], 0.5),
  }
}

type TruckPart = keyof ReturnType<typeof truckColors>
type TruckRole = `truck:${TruckPart}`
type StopRole = `${'wall' | 'roof' | 'annex'}:${ChapterId}`
export type MaterialRole = 'sea' | 'sand' | 'ground' | 'road' | 'pad' | TruckRole | StopRole

function roleColor(colors: ThemeColors, role: MaterialRole): string {
  switch (role) {
    case 'sea':
      return colors['scene/sea']
    case 'sand':
      return colors['scene/sand']
    case 'ground':
      return colors['scene/ground']
    case 'road':
      return colors['scene/road']
    case 'pad':
      // Площадка остановки — чуть светлее плиты острова.
      return mixHex(colors['scene/ground'], colors['bg/surface'], 0.25)
    case 'truck:cab':
    case 'truck:cargo':
    case 'truck:chassis':
      return truckColors(colors)[role.slice('truck:'.length) as TruckPart]
    default: {
      const [part, id] = role.split(':') as ['wall' | 'roof' | 'annex', ChapterId]
      return buildingColors(colors, id)[part]
    }
  }
}

export function createSceneMaterials(colors: () => ThemeColors) {
  const materials = new Map<MaterialRole, MeshLambertMaterial>()

  // flush: 'sync' — материал перекрашен к ближайшему кадру, без ожидания тика Vue.
  const stop = watchEffect(
    () => {
      const current = colors()
      for (const [role, material] of materials) material.color.set(roleColor(current, role))
    },
    { flush: 'sync' },
  )

  return {
    get(role: MaterialRole): MeshLambertMaterial {
      let material = materials.get(role)
      if (!material) {
        material = new MeshLambertMaterial({ color: roleColor(colors(), role) })
        materials.set(role, material)
      }
      return material
    },
    dispose() {
      stop()
      for (const material of materials.values()) material.dispose()
      materials.clear()
    },
  }
}
