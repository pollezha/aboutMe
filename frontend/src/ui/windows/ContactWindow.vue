<script setup lang="ts">
import { computed, useId } from 'vue'
import { resolveChapter } from '../../content/format'
import type { ContentBundle, ContentLink, LinkKind } from '../../content/types'
import { useUiStore } from '../../stores/ui'
import BaseButton from '../BaseButton.vue'
import Icon from '../Icon.vue'
import type { IconName } from '../icon-registry'
import StatusPill from '../StatusPill.vue'
import ChipList from './blocks/ChipList.vue'
import MetaRow from './blocks/MetaRow.vue'
import SectionHeading from './blocks/SectionHeading.vue'
import WindowColumns from './blocks/WindowColumns.vue'

// Figma Window/06 Contact (figma-windows.md §06). Форма «Message in a bottle» — этап 4; сейчас на её месте
// карточка с единственной primary-кнопкой окна (→ Telegram, FR17).
const props = withDefaults(defineProps<{ content: ContentBundle; now?: Date }>(), {
  now: () => new Date(),
})

const ui = useUiStore()
const chapter = computed(() => resolveChapter(props.content, 'contact', props.now))
const statusLabelId = useId()
const mailboxHeadingId = useId()

const CONTACT_ICON: Record<LinkKind, IconName> = {
  cv: 'download',
  telegram: 'telegram',
  github: 'github',
  email: 'email',
  hh: 'external',
  linkedin: 'external',
}

const isExternal = (link: ContentLink) => /^https?:/.test(link.href)
</script>

<template>
  <div class="chapter-body">
    <WindowColumns>
      <div class="chapter-body__column">
        <MetaRow v-bind="chapter.role" />
        <div class="contact-status" role="group" :aria-labelledby="statusLabelId">
          <p :id="statusLabelId" class="contact-status__label t-label-eyebrow">
            {{ chapter.status.label }}
          </p>
          <StatusPill>{{ chapter.status.value }}</StatusPill>
        </div>
        <MetaRow v-bind="chapter.basedIn" />
        <ChipList v-bind="chapter.languages" />
        <ChipList v-bind="chapter.goodFit" />
        <div>
          <BaseButton variant="ghost" @click="ui.openChapter(chapter.summaryLink.chapter)">
            {{ chapter.summaryLink.label }}
            <template #icon><Icon name="arrow-right" /></template>
          </BaseButton>
        </div>
        <ul class="contacts">
          <li v-for="link in chapter.contacts" :key="link.href">
            <BaseButton
              as="a"
              variant="secondary"
              :href="link.href"
              :target="isExternal(link) ? '_blank' : undefined"
              :download="link.kind === 'cv' ? '' : undefined"
            >
              {{ link.label }}
              <template #icon><Icon :name="CONTACT_ICON[link.kind]" /></template>
            </BaseButton>
          </li>
        </ul>
      </div>
      <section class="mailbox" :aria-labelledby="mailboxHeadingId">
        <SectionHeading :id="mailboxHeadingId">{{ chapter.mailbox.heading }}</SectionHeading>
        <p class="mailbox__text t-body-default">{{ chapter.mailbox.text }}</p>
        <BaseButton
          as="a"
          variant="primary"
          class="mailbox__action"
          :href="chapter.mailbox.action.href"
          target="_blank"
        >
          {{ chapter.mailbox.action.label }}
          <template #icon><Icon name="telegram" /></template>
        </BaseButton>
      </section>
    </WindowColumns>
  </div>
</template>

<style scoped>
.chapter-body__column {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-width: 0;
}

.contact-status {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

.contact-status__label {
  margin: 0;
  color: var(--text-secondary);
}

.contacts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.mailbox {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--radius-md);
  background: var(--bg-surface-alt);
}

.mailbox__text {
  margin: 0;
  color: var(--text-primary);
}

.mailbox__action {
  width: 100%;
}
</style>
