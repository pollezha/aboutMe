// GENERATED from figma-tokens.json by scripts/gen-theme.mjs — do not edit.
// Текстовый токен номера на пине/метке главы (text/<ink>), контрастнее на цвете главы.
export const PIN_INK = {
  day: {
    profile: 'on-dark',
    prospace: 'on-accent',
    timepath: 'on-accent',
    techstack: 'on-dark',
    education: 'on-dark',
    contact: 'on-dark',
    monitoring: 'on-accent',
    summary: 'on-dark',
  },
  evening: {
    profile: 'on-dark',
    prospace: 'on-accent',
    timepath: 'on-accent',
    techstack: 'on-dark',
    education: 'on-dark',
    contact: 'on-dark',
    monitoring: 'on-accent',
    summary: 'on-dark',
  },
  night: {
    profile: 'on-accent',
    prospace: 'on-accent',
    timepath: 'on-accent',
    techstack: 'on-accent',
    education: 'on-accent',
    contact: 'on-accent',
    monitoring: 'on-accent',
    summary: 'on-accent',
  },
} as const
export type PinChapter = keyof typeof PIN_INK.day
