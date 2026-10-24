import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { BUILD_TIME, contentFor, resolveHighlights } from '../../content'
import { createAppI18n, useLangStore, type Lang } from '../../locale'
import { useHero } from '../useHero'

function heroFor(lang: Lang) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useLangStore().syncLang(lang)
  let hero!: ReturnType<typeof useHero>
  const Host = defineComponent({
    setup() {
      hero = useHero()
      return () => null
    },
  })
  mount(Host, { global: { plugins: [pinia, createAppI18n(lang)] } })
  return hero
}

describe('useHero', () => {
  it('links the CV to the Russian PDF on the Russian bundle', () => {
    const hero = heroFor('ru')

    expect(hero.links.value.cv).toBe('/cv/Yakov_Polezhaev_CV_RU.pdf')
    expect(hero.cvLabel.value).toBe('Резюме (PDF)')
    expect(hero.links.value.telegram).toBe('https://t.me/poll_ezha')
  })

  it('shows the three highlights resolved from the current bundle at build time', () => {
    const hero = heroFor('ru')

    expect(hero.highlights.value).toHaveLength(3)
    expect(hero.highlights.value).toEqual(resolveHighlights(contentFor('ru'), BUILD_TIME))
  })

  it('follows the language store', () => {
    const hero = heroFor('en')
    expect(hero.profile.value.status).toBe(contentFor('en').profile.status)

    useLangStore().syncLang('ru')

    expect(hero.profile.value.status).toBe(contentFor('ru').profile.status)
    expect(hero.profile.value.location).toBe(contentFor('ru').profile.locationShort)
  })
})
