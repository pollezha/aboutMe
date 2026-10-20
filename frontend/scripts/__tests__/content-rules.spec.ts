import { describe, expect, it } from 'vitest'
import schema from '../../../content/schema/content.schema.json'
import en from '../../../content/en.json'
import { validateContent } from '../content-rules.ts'

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
