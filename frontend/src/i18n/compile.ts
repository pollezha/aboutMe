import type { MessageCompiler, MessageContext } from 'vue-i18n'

const PLACEHOLDER = /\{(\w+)\}/g

/**
 * Компилятор сообщений вместо встроенного (его сборка выкидывает флагом __INTLIFY_DROP_MESSAGE_COMPILER__,
 * vite.config): строки интерфейса используют только именованные подстановки `{name}`; plural, linked (`@:`)
 * и прочий синтаксис vue-i18n не поддерживаются и выводятся как написаны.
 */
export const compileMessage: MessageCompiler = (message) => {
  if (typeof message !== 'string') return () => ''
  if (!message.includes('{')) return () => message
  return (ctx: MessageContext) =>
    message.replace(PLACEHOLDER, (_, name: string) => String(ctx.named(name) ?? ''))
}
