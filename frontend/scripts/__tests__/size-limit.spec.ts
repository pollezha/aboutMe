// @vitest-environment node
// Бюджеты size-limit из package.json реально роняют проверку (T12, T3 спеки): правила гоняются на синтетическом
// dist/ во временном проекте внутри node_modules/.tmp — так size-limit и его плагин резолвятся из frontend.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pkg from '../../package.json'

// @types/node не в зависимостях проекта: нужные функции типизированы локально.
type Fs = {
  mkdirSync(path: string, options: { recursive: true }): void
  mkdtempSync(prefix: string): string
  writeFileSync(path: string, data: string | Uint8Array): void
  rmSync(path: string, options: { recursive: true; force: true }): void
}
type ChildProcess = {
  spawnSync(
    command: string,
    args: string[],
    options: { cwd: string; encoding: 'utf8'; shell: boolean },
  ): { status: number | null; stdout: string; stderr: string }
}
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs
const { spawnSync } = (await import(
  /* @vite-ignore */ 'node:child_process' as string
)) as ChildProcess

type Rule = { name: string; path: string; limit: string; gzip?: boolean; brotli?: boolean }
type Report = { name: string; passed: boolean }[]
const rules = pkg['size-limit'] as Rule[]

/** file:///C:/… → C:/… (Windows), file:///home/… → /home/… */
const frontendRoot = decodeURIComponent(new URL('../../', import.meta.url).pathname).replace(
  /^\/([A-Za-z]:)/,
  '$1',
)
const bin = `"${frontendRoot}node_modules/.bin/size-limit"`

/** Псевдослучайные байты: не сжимаются, gzip-размер ≈ сырой. */
function noise(bytes: number): Uint8Array {
  const data = new Uint8Array(bytes)
  let seed = 42
  for (let i = 0; i < bytes; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    data[i] = seed >> 16
  }
  return data
}

let project = ''

function writeProject(limit: (rule: Rule) => string, files: Record<string, number>) {
  fs.rmSync(`${project}/dist`, { recursive: true, force: true })
  fs.mkdirSync(`${project}/dist/assets`, { recursive: true })
  for (const [name, bytes] of Object.entries(files)) {
    fs.writeFileSync(`${project}/dist/assets/${name}`, noise(bytes))
  }
  const config = rules.map((rule) => ({ ...rule, limit: limit(rule) }))
  fs.writeFileSync(
    `${project}/package.json`,
    JSON.stringify({
      name: 'size-fixture',
      devDependencies: pkg.devDependencies,
      'size-limit': config,
    }),
  )
}

function sizeLimit() {
  const result = spawnSync(bin, ['--json'], { cwd: project, encoding: 'utf8', shell: true })
  return { status: result.status, output: result.stderr || result.stdout, stdout: result.stdout }
}

function failed(stdout: string): string[] {
  return (JSON.parse(stdout) as Report).filter((entry) => !entry.passed).map((entry) => entry.name)
}

const smallDist = {
  'app-abc123.js': 2_000,
  'Scene-abc123.js': 4_000,
  'onest-cyrillic-wght-normal-abc123.woff2': 3_000,
}

describe('size-limit budgets', () => {
  beforeAll(() => {
    fs.mkdirSync(`${frontendRoot}node_modules/.tmp`, { recursive: true })
    project = fs.mkdtempSync(`${frontendRoot}node_modules/.tmp/size-limit-`)
  })
  afterAll(() => fs.rmSync(project, { recursive: true, force: true }))

  it('has budgets for the main chunk, the scene chunk and the fonts', () => {
    expect(rules.map((rule) => [rule.path, rule.limit])).toEqual([
      ['dist/assets/app-*.js', '150 kB'],
      ['dist/assets/Scene-*.js', '2 MB'],
      ['dist/assets/*.woff2', '150 kB'],
    ])
  })

  it('passes a small build with the real limits', () => {
    writeProject((rule) => rule.limit, smallDist)

    const result = sizeLimit()

    expect(result.status, result.output).toBe(0)
  }, 60_000)

  it('fails every rule when its budget is lowered to 1 byte', () => {
    writeProject(() => '1 B', smallDist)

    const result = sizeLimit()

    expect(result.status).not.toBe(0)
    expect(failed(result.stdout)).toEqual(rules.map((rule) => rule.name))
  }, 60_000)

  it('sums all woff2 files against the font budget', () => {
    writeProject((rule) => rule.limit, {
      ...smallDist,
      'onest-cyrillic-wght-normal-abc123.woff2': 80_000,
      'ibm-plex-mono-latin-400-normal-abc123.woff2': 80_000,
    })

    const result = sizeLimit()

    expect(result.status).not.toBe(0)
    expect(failed(result.stdout)).toEqual([rules[2]?.name])
  }, 60_000)
})
