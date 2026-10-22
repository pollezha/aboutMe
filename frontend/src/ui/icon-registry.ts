export type IconName =
  | 'arrow-right'
  | 'external'
  | 'close'
  | 'play'
  | 'pause'
  | 'theme'
  | 'lang'
  | 'rotate'
  | 'email'
  | 'telegram'
  | 'github'
  | 'download'
  | 'check'

const files = import.meta.glob<string>('./icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const icons: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [path.replace(/^.*\/(.+)\.svg$/, '$1'), svg]),
)

export const ICON_NAMES = Object.keys(icons) as IconName[]

export function iconSvg(name: IconName): string {
  return icons[name] ?? ''
}
