# public/img

Static images served as-is.

- `island-<theme>.webp` (1200×1086) and `island-<theme>@2x.webp` (2400×2172) — render of the 3D island
  for the 2D map (`src/fallback2d/StaticMap.vue`), one per theme. Regenerate with `npm run island`
  after any scene change; hotspots in `scripts/design/figma-2d-map.json` are checked against the same
  framing by `src/scene/__tests__/framing.spec.ts`. Budget: 1x ≤ 120 KB each.
