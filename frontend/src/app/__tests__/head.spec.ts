import { describe, expect, it } from 'vitest'
import en from '../../../../content/en.json'
import type { ContentBundle } from '../../content/types'
import { siteHead } from '../head'

const content = en as ContentBundle

function meta(head: ReturnType<typeof siteHead>, key: string) {
  return head.meta.find((tag) => tag.name === key || tag.property === key)?.content
}

function alternates(head: ReturnType<typeof siteHead>) {
  return head.link.filter((tag) => tag.rel === 'alternate').map((tag) => [tag.hreflang, tag.href])
}

describe('siteHead (FR11)', () => {
  it('builds title, description and Open Graph from the profile', () => {
    const head = siteHead({ content, langs: ['en'] })

    expect(head.title).toBe('Yakov Polezhaev — .NET Backend Developer')
    const description = meta(head, 'description') ?? ''
    expect(description).toContain('.NET Backend Developer')
    expect(description).toContain('Open to work')
    expect(description).toContain('1000+')
    expect(description.length).toBeLessThanOrEqual(160)
    expect(meta(head, 'og:title')).toBe(head.title)
    expect(meta(head, 'og:description')).toBe(description)
    expect(meta(head, 'og:type')).toBe('website')
    expect(meta(head, 'og:locale')).toBe('en_US')
    expect(meta(head, 'og:image')).toBe('/og.png')
    expect(meta(head, 'twitter:card')).toBe('summary_large_image')
    expect(meta(head, 'twitter:title')).toBe(head.title)
  })

  it('puts the content language on <html lang>', () => {
    expect(siteHead({ content, langs: ['en'] }).htmlAttrs).toEqual({ lang: 'en' })
  })

  it('links only languages that have content, plus x-default → /', () => {
    expect(alternates(siteHead({ content, langs: ['en'] }))).toEqual([
      ['en', '/'],
      ['x-default', '/'],
    ])
    expect(alternates(siteHead({ content, langs: ['en', 'ru'] }))).toEqual([
      ['en', '/'],
      ['ru', '/ru/'],
      ['x-default', '/'],
    ])
  })

  it('uses relative URLs and no og:url while the site origin is unknown', () => {
    const head = siteHead({ content, langs: ['en'] })

    expect(head.link.find((tag) => tag.rel === 'canonical')?.href).toBe('/')
    expect(meta(head, 'og:url')).toBeUndefined()
  })

  it('makes canonical, hreflang, og:url and og:image absolute with the site origin', () => {
    const head = siteHead({
      content: { ...content, lang: 'ru' },
      langs: ['en', 'ru'],
      origin: 'https://example.dev/',
    })

    expect(head.link.find((tag) => tag.rel === 'canonical')?.href).toBe('https://example.dev/ru/')
    expect(alternates(head)).toEqual([
      ['en', 'https://example.dev/'],
      ['ru', 'https://example.dev/ru/'],
      ['x-default', 'https://example.dev/'],
    ])
    expect(meta(head, 'og:url')).toBe('https://example.dev/ru/')
    expect(meta(head, 'og:image')).toBe('https://example.dev/og.png')
    expect(meta(head, 'og:locale')).toBe('ru_RU')
  })
})
