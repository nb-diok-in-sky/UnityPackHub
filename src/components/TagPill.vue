<script setup lang="ts">
import type { Tag } from '../types/asset'

defineProps<{
  tag: Tag
  small?: boolean
}>()
</script>

<template>
  <span
    class="tag-pill"
    :class="{ 'tag-pill--small': small }"
    :style="{
      backgroundColor: tag.color + '18',
      color: tag.color,
    }"
  >
    {{ tag.label }}
  </span>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.tag-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: $radius-tag;
  font-size: $font-size-tag;
  font-weight: $font-weight-tag;
  line-height: 1.6;
  white-space: nowrap;
  transition: $transition-fast;

  &--small {
    padding: 1px 6px;
    font-size: 10px;
  }
}
</style>
