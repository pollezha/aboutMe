import type { Component } from 'vue'
import type { ChapterId } from '../../content/chapters'
import type { IconName } from '../icon-registry'
import PlaceholderBody from './PlaceholderBody.vue'
import ProSpaceWindow from './ProSpaceWindow.vue'
import ProfileWindow from './ProfileWindow.vue'
import TimePathWindow from './TimePathWindow.vue'

/**
 * Окно главы: тело (props `{ content: ContentBundle; now?: Date }`) и знак в строке eyebrow.
 * Шапку (eyebrow/title/subtitle), подвал (proofLinks) и prev/next рисует App через ChapterWindow.
 * Импорты синхронные: окна попадают в предрендер (vite-ssg, T5).
 */
export interface WindowEntry {
  body: Component
  sign: IconName
}

export const WINDOWS: Record<ChapterId, WindowEntry> = {
  profile: { body: ProfileWindow, sign: 'sign-licence' },
  prospace: { body: ProSpaceWindow, sign: 'sign-waybill' },
  timepath: { body: TimePathWindow, sign: 'sign-route' },
  techstack: { body: PlaceholderBody, sign: 'sign-rack' },
  education: { body: PlaceholderBody, sign: 'sign-diploma' },
  contact: { body: PlaceholderBody, sign: 'sign-envelope' },
  summary: { body: PlaceholderBody, sign: 'sign-summary' },
  monitoring: { body: PlaceholderBody, sign: 'sign-monitoring' },
}
