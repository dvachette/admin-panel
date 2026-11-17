<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    values: number[]
    /** Fixed top of the scale (e.g. 100 for a percentage); the series maximum otherwise */
    max?: number
    color?: string
    height?: number
    label?: string
  }>(),
  { max: undefined, color: 'var(--p-primary-400)', height: 48, label: '' },
)

const WIDTH = 200

const points = computed(() => {
  const values = props.values
  if (values.length < 2) return ''
  const top = props.max ?? Math.max(...values, 1)
  const step = WIDTH / (values.length - 1)
  return values
    .map((v, i) => {
      const y = props.height - (Math.min(v, top) / top) * (props.height - 2) - 1
      return `${(i * step).toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const area = computed(() =>
  points.value ? `0,${props.height} ${points.value} ${WIDTH},${props.height}` : '',
)
</script>

<template>
  <svg
    class="sparkline"
    :viewBox="`0 0 ${WIDTH} ${height}`"
    preserveAspectRatio="none"
    :height="height"
    role="img"
    :aria-label="label"
  >
    <polygon v-if="area" :points="area" :fill="color" fill-opacity="0.15" />
    <polyline
      v-if="points"
      :points="points"
      fill="none"
      :stroke="color"
      stroke-width="1.5"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<style scoped>
.sparkline {
  display: block;
  width: 100%;
}
</style>
