import { describe, expect, it, vi } from 'vitest'
import { Group, Mesh } from 'three'
import { chapterClickHandler, pickChapter } from '../pick'

function buildingOf(chapter: unknown) {
  const group = new Group()
  group.userData.chapter = chapter
  const wall = new Mesh()
  group.add(wall)
  return wall
}

describe('pickChapter', () => {
  it('finds the chapter on the building group of the hit mesh', () => {
    expect(pickChapter(buildingOf('prospace'))).toBe('prospace')
  })

  it('returns null for scenery and unknown ids', () => {
    expect(pickChapter(new Mesh())).toBeNull()
    expect(pickChapter(buildingOf('casino'))).toBeNull()
  })
})

describe('chapterClickHandler', () => {
  it('opens ProSpace when its building is clicked', () => {
    const open = vi.fn()
    const stop = vi.fn()

    chapterClickHandler(open)({ object: buildingOf('prospace'), stopPropagation: stop })

    expect(open).toHaveBeenCalledWith('prospace')
    expect(stop).toHaveBeenCalled()
  })

  it('does nothing for a click on scenery', () => {
    const open = vi.fn()

    chapterClickHandler(open)({ object: new Mesh(), stopPropagation: () => {} })

    expect(open).not.toHaveBeenCalled()
  })
})
