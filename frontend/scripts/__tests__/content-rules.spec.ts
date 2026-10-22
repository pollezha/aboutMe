import { describe, expect, it } from 'vitest'
import schema from '../../../content/schema/content.schema.json'
import en from '../../../content/en.json'
import { validateContent, validateContentFile } from '../content-rules.ts'

// Опубликованный контент как валидная основа: каждый тест портит одно поле.
function validContent(): typeof en {
  return JSON.parse(JSON.stringify(en))
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

describe('validateContent: chapters', () => {
  type Loose = Record<string, unknown>
  function chapters(content: ReturnType<typeof validContent>) {
    return content.chapters as unknown as Record<string, Loose>
  }
  function firstServer(content: ReturnType<typeof validContent>) {
    return content.chapters.techstack.racks[0]!.servers[0]! as Loose
  }

  it('requires every chapter of the island', () => {
    const content = validContent()
    delete chapters(content).monitoring

    expect(validateContent(content, schema)).toContainEqual({
      path: '/chapters',
      message: "must have required property 'monitoring'",
    })
  })

  it('rejects a chapter without a title', () => {
    const content = validContent()
    delete chapters(content).prospace!.title

    expect(validateContent(content, schema)).toContainEqual({
      path: '/chapters/prospace',
      message: "must have required property 'title'",
    })
  })

  it.each(['[ADD]', '[ADD: a fourth metric]'])(
    'rejects placeholder %j deep inside a chapter and names the field',
    (placeholder) => {
      const content = validContent()
      content.chapters.prospace.keyResults.items[1]!.how = placeholder

      expect(validateContent(content, schema)).toEqual([
        {
          path: '/chapters/prospace/keyResults/items/1/how',
          message: 'placeholder [ADD] is not allowed in published content',
        },
      ])
    },
  )

  it('rejects a server that refers to an unknown experience id', () => {
    const content = validContent()
    firstServer(content).usedIn = ['timepath', 'acme']

    expect(validateContent(content, schema)).toEqual([
      {
        path: '/chapters/techstack/racks/0/servers/0/usedIn/1',
        message: 'unknown experience id "acme"',
      },
    ])
  })

  it('requires at least one usedIn entry on a server', () => {
    const content = validContent()
    firstServer(content).usedIn = []

    expect(validateContent(content, schema).map((issue) => issue.path)).toContain(
      '/chapters/techstack/racks/0/servers/0/usedIn',
    )
  })

  it('rejects a chapter period bound to an unknown experience id', () => {
    const content = validContent()
    content.chapters.prospace.experienceId = 'acme'

    expect(validateContent(content, schema)).toContainEqual({
      path: '/chapters/prospace/experienceId',
      message: 'unknown experience id "acme"',
    })
  })

  it.each(['#', '//evil.example', 'http://x', 'javascript:alert(1)', 'prospace.tech'])(
    'rejects proof link href %j',
    (href) => {
      const content = validContent()
      const link = content.chapters.prospace.proofLinks[0]! as Loose
      link.href = href

      expect(validateContent(content, schema).map((issue) => issue.path)).toContain(
        '/chapters/prospace/proofLinks/0/href',
      )
    },
  )

  it.each(['https://prospace.tech', '/cv/Yakov_Polezhaev_CV_EN.pdf', 'mailto:a@b.c'])(
    'accepts proof link href %j',
    (href) => {
      const content = validContent()
      const link = content.chapters.prospace.proofLinks[0]! as Loose
      link.href = href

      expect(validateContent(content, schema)).toEqual([])
    },
  )

  it('rejects an unknown date token in chapter text', () => {
    const content = validContent()
    content.chapters.profile.subtitle = 'on the road since {sinse}'

    expect(validateContent(content, schema)).toEqual([
      {
        path: '/chapters/profile/subtitle',
        message:
          'unknown token {sinse}; allowed: {since}, {sinceShort}, {experience}, {period}, {span}',
      },
    ])
  })

  it('rejects {period} in a chapter that is not bound to an experience', () => {
    const content = validContent()
    content.chapters.techstack.eyebrow = 'Data center · {period}'

    expect(validateContent(content, schema)).toEqual([
      {
        path: '/chapters/techstack/eyebrow',
        message: '{period} needs experienceId on the chapter',
      },
    ])
  })
})

describe('published content/en.json', () => {
  const text = JSON.stringify(en)

  it('has no placeholders and no "#" links', () => {
    expect(text).not.toMatch(/\[ADD/)
    expect(text).not.toContain('"#"')
  })

  it('binds the role chapters to their experience entries', () => {
    expect(en.chapters.prospace.experienceId).toBe('prospace')
    expect(en.chapters.timepath.experienceId).toBe('timepath')
  })
})
