import { describe, expect, it } from 'vitest'
import schema from '../../../content/schema/content.schema.json'
import en from '../../../content/en.json'
import { validateContent, validateContentFile } from '../content-rules.ts'

function validContent() {
  return {
    contentVersion: '2026-10-20T00:00:00Z',
    lang: 'en',
    profile: {
      name: 'Yakov Polezhaev',
      role: '.NET Backend Developer',
      status: 'Open to work',
      workFormat: 'Remote / relocation',
      location: 'Based in Serbia',
      locationShort: 'Serbia',
      highlights: [
        { label: 'A', value: '1', note: 'a' },
        { label: 'B', value: '2', note: 'b' },
        { kind: 'experience', label: 'C' },
      ],
      links: [{ kind: 'github', label: 'GitHub', href: 'https://github.com/pollezha' }],
    },
    experience: [{ id: 'a', company: 'A', role: 'R', from: '2024-07', to: null }],
  }
}

describe('validateContent', () => {
  it('accepts valid content', () => {
    expect(validateContent(validContent(), schema)).toEqual([])
  })

  it('accepts the published content/en.json', () => {
    expect(validateContent(en, schema)).toEqual([])
  })

  it('rejects an [ADD] placeholder and names the field', () => {
    const content = validContent()
    content.profile.role = 'Backend developer [ADD]'

    expect(validateContent(content, schema)).toEqual([
      { path: '/profile/role', message: 'placeholder [ADD] is not allowed in published content' },
    ])
  })

  it.each(['#', '', '  '])('rejects href %j and names the field', (href) => {
    const content = validContent()
    content.profile.links[0]!.href = href

    const issues = validateContent(content, schema)

    expect(issues).toContainEqual({
      path: '/profile/links/0/href',
      message: 'empty or "#" link is not allowed in published content',
    })
  })

  it('reports schema violations with the field path', () => {
    const content = validContent() as Record<string, unknown>
    delete (content.profile as Record<string, unknown>).name

    const issues = validateContent(content, schema)

    expect(issues).toContainEqual({
      path: '/profile',
      message: "must have required property 'name'",
    })
  })
})

describe('validateContent: link href', () => {
  it.each(['javascript:alert(1)', 'http://x'])('rejects unsafe href %j', (href) => {
    const content = validContent()
    content.profile.links[0]!.href = href

    const issues = validateContent(content, schema)

    expect(issues.map((issue) => issue.path)).toContain('/profile/links/0/href')
  })

  it.each(['https://example.com', 'mailto:a@b', '/cv.pdf'])('accepts safe href %j', (href) => {
    const content = validContent()
    content.profile.links[0]!.href = href

    expect(validateContent(content, schema)).toEqual([])
  })
})

describe('validateContent: schema messages', () => {
  it('names an unknown property in the path', () => {
    const content = validContent()
    ;(content.profile as Record<string, unknown>).loction = 'Moscow'

    expect(validateContent(content, schema)).toEqual([
      { path: '/profile/loction', message: 'unknown property "loction"' },
    ])
  })

  it('lists allowed values for an enum violation', () => {
    const content = validContent()
    content.profile.links[0]!.kind = 'vk'

    const issues = validateContent(content, schema)

    expect(issues).toHaveLength(1)
    expect(issues[0]!.path).toBe('/profile/links/0/kind')
    expect(issues[0]!.message).toContain('github, telegram, hh, linkedin, email, cv')
  })
})

describe('validateContent: experience dates', () => {
  const now = new Date(2026, 9, 15) // октябрь 2026

  function withPeriod(from: string, to: string | null) {
    const content = validContent()
    content.experience[0] = { ...content.experience[0]!, from, to: to as null }
    return content
  }

  it('rejects a period that ends before it starts', () => {
    expect(validateContent(withPeriod('2024-07', '2024-06'), schema, now)).toContainEqual({
      path: '/experience/0/to',
      message: 'must not be earlier than from',
    })
  })

  it('accepts a one-month period and an open period', () => {
    expect(validateContent(withPeriod('2024-07', '2024-07'), schema, now)).toEqual([])
    expect(validateContent(withPeriod('2024-07', null), schema, now)).toEqual([])
  })

  it('rejects a start in the future but accepts the current month', () => {
    expect(validateContent(withPeriod('2026-11', null), schema, now)).toContainEqual({
      path: '/experience/0/from',
      message: 'must not be in the future',
    })
    expect(validateContent(withPeriod('2026-10', null), schema, now)).toEqual([])
  })
})

describe('validateContentFile', () => {
  it('accepts valid content whose lang matches the file name', () => {
    expect(validateContentFile('en.json', JSON.stringify(validContent()), schema)).toEqual([])
  })

  it('reports invalid JSON instead of throwing', () => {
    const issues = validateContentFile('en.json', '{ "lang": ', schema)

    expect(issues).toHaveLength(1)
    expect(issues[0]!.path).toBe('/')
    expect(issues[0]!.message).toMatch(/^invalid JSON — /)
  })

  it('rejects lang that does not match the file name', () => {
    const issues = validateContentFile('ru.json', JSON.stringify(validContent()), schema)

    expect(issues).toEqual([{ path: '/lang', message: 'must match file name "ru"' }])
  })
})
