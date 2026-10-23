/** ISO-время сборки (vite.config → define). */
declare const __BUILD_TIME__: string

interface ImportMetaEnv {
  /** Origin сайта для canonical/hreflang/og:url (https://…); пусто — относительные URL. */
  readonly VITE_SITE_ORIGIN?: string
}
