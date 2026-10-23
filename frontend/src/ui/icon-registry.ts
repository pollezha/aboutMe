export type IconName =
  | 'arrow-right'
  | 'external'
  | 'close'
  | 'play'
  | 'pause'
  | 'theme'
  | 'lang'
  | 'rotate'
  | 'map'
  | 'email'
  | 'telegram'
  | 'github'
  | 'download'
  | 'check'
  | 'sign-licence'
  | 'sign-waybill'
  | 'sign-route'
  | 'sign-rack'
  | 'sign-diploma'
  | 'sign-envelope'
  | 'sign-summary'
  | 'sign-monitoring'

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
