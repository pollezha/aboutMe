# public/img

Static images served as-is.

- `island-<theme>.webp` — render of the island for the 2D map (`src/fallback2d/StaticMap.vue`),
  same framing as `scripts/design/figma-2d-map.json`. The render arrives in stage 3; until then
  the map shows the sea fill and the image is hidden on load error.
