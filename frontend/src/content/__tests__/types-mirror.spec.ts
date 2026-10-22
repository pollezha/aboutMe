import { describe, expect, it } from 'vitest'
import schema from '../../../../content/schema/content.schema.json'
import type {
  Chapters,
  ContactChapter,
  ContentBundle,
  EducationChapter,
  MonitoringChapter,
  ProfileChapter,
  ProSpaceChapter,
  Rack,
  Server,
  SummaryChapter,
  TechStackChapter,
  TimePathChapter,
} from '../types'

// types.ts зеркалит схему: ключи каждого объекта перечислены через Record<keyof T, true>,
// поэтому пропуск или лишний ключ в типе ломает typecheck, а расхождение со схемой — этот тест.

function keys<T>(record: Record<keyof T, true>): string[] {
  return Object.keys(record).sort()
}

type Def = { properties: Record<string, unknown> }
const defs = (schema as unknown as { $defs: Record<string, Def> }).$defs

function schemaKeys(def: Def): string[] {
  return Object.keys(def.properties)
    .filter((key) => key !== '$schema')
    .sort()
}

const base = { eyebrow: true, title: true, subtitle: true, proofLinks: true } as const

describe('content types mirror the schema', () => {
  it('top level', () => {
    expect(
      keys<ContentBundle>({
        contentVersion: true,
        lang: true,
        profile: true,
        experience: true,
        chapters: true,
      }),
    ).toEqual(schemaKeys(schema as unknown as Def))
  })

  it('chapters', () => {
    expect(
      keys<Chapters>({
        profile: true,
        prospace: true,
        timepath: true,
        techstack: true,
        education: true,
        contact: true,
        summary: true,
        monitoring: true,
      }),
    ).toEqual(
      schemaKeys((schema as unknown as { properties: { chapters: Def } }).properties.chapters),
    )
  })

  it.each([
    [
      'profileChapter',
      keys<ProfileChapter>({
        ...base,
        name: true,
        since: true,
        keyNumbers: true,
        about: true,
        languages: true,
        lookingFor: true,
      }),
    ],
    [
      'prospaceChapter',
      keys<ProSpaceChapter>({
        ...base,
        experienceId: true,
        metrics: true,
        keyResults: true,
        stack: true,
        team: true,
      }),
    ],
    [
      'timepathChapter',
      keys<TimePathChapter>({
        ...base,
        experienceId: true,
        metricGroups: true,
        keyResults: true,
        stack: true,
      }),
    ],
    [
      'techstackChapter',
      keys<TechStackChapter>({
        ...base,
        experienceLabel: true,
        whereLabel: true,
        whatLabel: true,
        racks: true,
      }),
    ],
    [
      'educationChapter',
      keys<EducationChapter>({
        ...base,
        programme: true,
        format: true,
        graduated: true,
        thesis: true,
        teamProjects: true,
        courses: true,
        studyWork: true,
        languages: true,
      }),
    ],
    [
      'contactChapter',
      keys<ContactChapter>({
        ...base,
        role: true,
        status: true,
        basedIn: true,
        languages: true,
        goodFit: true,
        summaryLink: true,
        contacts: true,
        mailbox: true,
      }),
    ],
    ['summaryChapter', keys<SummaryChapter>({ ...base, metrics: true, whatIDo: true, cta: true })],
    [
      'monitoringChapter',
      keys<MonitoringChapter>({
        ...base,
        metrics: true,
        clickPath: true,
        observability: true,
      }),
    ],
    ['rack', keys<Rack>({ name: true, servers: true })],
    ['server', keys<Server>({ name: true, usedIn: true, where: true, what: true })],
  ])('%s', (defName, typeKeys) => {
    expect(defs[defName], `schema $defs.${defName}`).toBeDefined()
    expect(typeKeys).toEqual(schemaKeys(defs[defName]!))
  })
})
