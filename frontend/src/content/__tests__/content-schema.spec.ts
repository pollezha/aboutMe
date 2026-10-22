import { describe, expect, it } from 'vitest'
import schema from '../../../../content/schema/content.schema.json'
import en from '../../../../content/en.json'
import { validateContent } from '../../../scripts/content-rules'

type Editable = {
  profile: Record<string, unknown> & { highlights: Record<string, unknown>[] }
  experience: Record<string, unknown>[]
}

function content(): Editable {
  return structuredClone(en) as unknown as Editable
}

describe('content schema: first-screen fields', () => {
  it('accepts the published content/en.json', () => {
    expect(validateContent(en, schema)).toEqual([])
  })

  it('requires profile.location', () => {
    const c = content()
    delete c.profile.location

    expect(validateContent(c, schema)).toContainEqual({
      path: '/profile',
      message: "must have required property 'location'",
    })
  })

  it('requires exactly three highlights', () => {
    const c = content()
    c.profile.highlights.pop()

    expect(validateContent(c, schema).map((issue) => issue.path)).toContain('/profile/highlights')
  })

  it('rejects a hard-coded value on the computed experience highlight', () => {
    const c = content()
    c.profile.highlights[2] = { kind: 'experience', label: 'IN PRODUCTION', value: '2+ yrs' }

    expect(validateContent(c, schema)).not.toEqual([])
  })

  it('requires experience[]', () => {
    const c = content() as unknown as Record<string, unknown>
    delete c.experience

    expect(validateContent(c, schema)).toContainEqual({
      path: '/',
      message: "must have required property 'experience'",
    })
  })

  it.each(['2024-7', '2024-13', '07-2024', ''])('rejects experience date %j', (from) => {
    const c = content()
    c.experience[0]!.from = from

    expect(validateContent(c, schema).map((issue) => issue.path)).toContain('/experience/0/from')
  })

  it('accepts to: null as the current role marker', () => {
    const c = content()
    c.experience[0]!.to = null

    expect(validateContent(c, schema)).toEqual([])
  })

  it('rejects [ADD] in experience', () => {
    const c = content()
    c.experience[0]!.company = '[ADD]'

    expect(validateContent(c, schema)).toContainEqual({
      path: '/experience/0/company',
      message: 'placeholder [ADD] is not allowed in published content',
    })
  })
})
