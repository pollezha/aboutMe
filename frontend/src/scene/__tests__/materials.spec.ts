import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { palette } from '../../theme/palette'
import type { Theme } from '../../stores/ui'
import { buildingColors, createSceneMaterials, mixHex, truckColors } from '../materials'

const hex = (value: string) => value.toLowerCase()

describe('mixHex', () => {
  it('blends two colours', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000')
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#ffffff')
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080')
  })
})

describe('buildingColors', () => {
  it('derives walls and roof from the chapter colour of the theme', () => {
    const day = buildingColors(palette.day, 'prospace')
    expect(day.wall).toBe(hex(palette.day['chapter/prospace']))
    expect(day.roof).not.toBe(day.wall)
    expect(day.annex).not.toBe(day.wall)
    expect(buildingColors(palette.night, 'prospace').wall).toBe(
      hex(palette.night['chapter/prospace']),
    )
  })
})

describe('createSceneMaterials', () => {
  it('shares one material per colour role and recolours it when the theme changes', () => {
    const theme = ref<Theme>('day')
    const materials = createSceneMaterials(() => palette[theme.value])
    const wall = materials.get('wall:prospace')
    expect(materials.get('wall:prospace')).toBe(wall)
    expect(`#${wall.color.getHexString()}`).toBe(hex(palette.day['chapter/prospace']))
    expect(`#${materials.get('sea').color.getHexString()}`).toBe(hex(palette.day['scene/sea']))

    theme.value = 'night'

    expect(`#${wall.color.getHexString()}`).toBe(hex(palette.night['chapter/prospace']))
    expect(`#${materials.get('sea').color.getHexString()}`).toBe(hex(palette.night['scene/sea']))
    materials.dispose()
  })
})

describe('truck materials', () => {
  it('paint the cab in the accent and the rest from scene colours of the theme', () => {
    const theme = ref<Theme>('day')
    const materials = createSceneMaterials(() => palette[theme.value])
    const color = (role: Parameters<typeof materials.get>[0]) =>
      `#${materials.get(role).color.getHexString()}`

    expect(color('truck:cab')).toBe(hex(palette.day['accent/primary']))
    expect(color('truck:cargo')).toBe(
      mixHex(palette.day['bg/surface'], palette.day['scene/sand'], 0.2),
    )
    expect(color('truck:chassis')).toBe(truckColors(palette.day).chassis)

    theme.value = 'night'
    expect(color('truck:cab')).toBe(hex(palette.night['accent/primary']))
    materials.dispose()
  })
})
