import { describe, expect, it } from 'vitest'
import { SCENE_READY_BUDGET_MS, verdict } from '../scene-ready.mjs'

describe('scene_ready verdict', () => {
  it('uses the 4 s budget from the spec (T2)', () => {
    expect(SCENE_READY_BUDGET_MS).toBe(4000)
  })

  it('passes when the median run is within the budget', () => {
    expect(verdict([3900, 4500, 3100])).toEqual({ median: 3900, passed: true })
  })

  it('fails when the median run is over the budget', () => {
    expect(verdict([4100, 3000, 4200])).toEqual({ median: 4100, passed: false })
  })

  it('fails when a run never reached scene_ready', () => {
    expect(verdict([1000, null, 1200]).passed).toBe(false)
  })

  it('takes the budget as a parameter', () => {
    expect(verdict([500], 400).passed).toBe(false)
  })
})
