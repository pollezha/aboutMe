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
      links: [{ kind: 'github', label: 'GitHub', href: 'https://github.com/pollezha' }],
    },
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
