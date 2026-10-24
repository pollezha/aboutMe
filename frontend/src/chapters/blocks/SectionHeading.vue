<!-- Figma Heading/Section: заголовок секции внутри окна (h2 — заголовок окна). -->
<template>
  <h3 class="section-heading t-heading-section"><slot /></h3>
</template>

<style scoped>
.section-heading {
  margin: 0;
  color: var(--text-primary);
}
</style>
