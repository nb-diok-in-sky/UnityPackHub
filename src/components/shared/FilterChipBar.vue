<script setup lang="ts" generic="T extends string">
import type { FilterOption } from "../../types/ui";
defineProps<{ options: FilterOption<T>[]; active: T }>();
defineEmits<{ select: [value: T] }>();
</script>
<template>
  <div class="chips">
    <button
      v-for="item in options"
      v-show="!item.hidden"
      :key="item.value"
      :class="{ active: item.value === active }"
      @click="$emit('select', item.value)"
    >
      <q-icon v-if="item.icon" :name="item.icon" size="12px" />{{ item.label
      }}<small>{{ item.count }}</small>
    </button>
  </div>
</template>
<style scoped lang="scss">
@use "../../styles/variables" as *;
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chips button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px solid $color-border;
  border-radius: 14px;
  background: transparent;
  color: $color-secondary;
  cursor: pointer;
  font: 11px $font-family;
  transition: $transition-fast;
}
.chips button:hover {
  border-color: $apple-blue;
  color: $apple-blue;
}
.chips button.active {
  border-color: $apple-blue;
  background: $apple-blue;
  color: white;
}
.chips small {
  font-size: 10px;
  opacity: 0.7;
}
</style>
