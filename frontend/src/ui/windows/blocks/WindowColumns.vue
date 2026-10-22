<!-- Figma Columns gap 32: колонки равной ширины на desktop, одна колонка < 768. -->
<template>
  <div class="columns"><slot /></div>
</template>

<style scoped>
.columns {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: var(--space-8);
  align-items: start;
}

@media (width < 768px) {
  .columns {
    grid-auto-flow: row;
    gap: var(--space-6);
  }
}
</style>
