import type { Component } from 'vue'
import type { ChapterId } from '../content'
import type { IconName } from '../shared/ui'
import ContactWindow from './ContactWindow.vue'
import EducationWindow from './EducationWindow.vue'
import MonitoringWindow from './MonitoringWindow.vue'
import ProSpaceWindow from './ProSpaceWindow.vue'
import ProfileWindow from './ProfileWindow.vue'
import SummaryWindow from './SummaryWindow.vue'
import TechStackWindow from './TechStackWindow.vue'
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
  techstack: { body: TechStackWindow, sign: 'sign-rack' },
  education: { body: EducationWindow, sign: 'sign-diploma' },
  contact: { body: ContactWindow, sign: 'sign-envelope' },
  summary: { body: SummaryWindow, sign: 'sign-summary' },
  monitoring: { body: MonitoringWindow, sign: 'sign-monitoring' },
}
