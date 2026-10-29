<script setup>
defineProps({ name: String, size: { type: [Number, String], default: 20 } })
const shapes = {
  plus: 'M12 5v14M5 12h14', arrow: 'M7 17 17 7M7 7h10v10', send: 'm5 12 7-7 7 7M12 5v14',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  chat: 'M21 11a8 8 0 0 1-8 8H6l-4 3V11a8 8 0 0 1 8-8h3a8 8 0 0 1 8 8ZM7 10h10M7 14h6',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l5 5',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z',
  file: 'M14 2H5v20h14V7l-5-5ZM14 2v6h5M8 13h8M8 17h5',
  folder: 'M3 6h7l2 3h9v11H3V6ZM3 6V4h7l2 2h7v3',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', terminal: 'm5 6 5 6-5 6M13 18h6',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  chevron: 'm9 5 7 7-7 7', check: 'm5 12 4 4L19 6', x: 'm6 6 12 12M18 6 6 18',
  copy: 'M8 8h13v13H8zM16 8V3H3v13h5', refresh: 'M20 8a8 8 0 1 0 0 8M20 3v5h-5',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.5 8.5a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1-1.5 3M12 17h.01',
  stop: 'M6 6h12v12H6z', menu: 'M4 6h16M4 12h16M4 18h16',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6M12 7h.01',
  layers: 'm12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5'
}
</script>
<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="shapes[name] || shapes.spark" /></svg></template>
