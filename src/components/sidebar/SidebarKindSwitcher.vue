<script setup lang="ts">
import type { AssetKind } from "../../types/asset";

defineProps<{
  activeKind: AssetKind;
  packageCount: number;
  modelCount: number;
  packageLabel: string;
  modelLabel: string;
}>();

defineEmits<{ select: [kind: AssetKind] }>();
</script>

<template>
  <div class="kind-switcher">
    <button
      v-for="item in [
        {
          kind: 'package' as const,
          icon: 'inventory_2',
          label: packageLabel,
          count: packageCount,
        },
        {
          kind: 'model' as const,
          icon: 'view_in_ar',
          label: modelLabel,
          count: modelCount,
        },
      ]"
      :key="item.kind"
      class="kind-button"
      :class="{ 'kind-button--active': activeKind === item.kind }"
      @click="$emit('select', item.kind)"
    >
      <q-icon :name="item.icon" size="17px" />
      <span>{{ item.label }}</span>
      <span class="count">{{ item.count }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/variables" as *;

.kind-switcher {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.kind-button {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid $color-border;
  background: var(--hover-overlay);
  border-radius: 8px;
  color: $color-secondary;
  cursor: pointer;
  font-size: 12px;
  transition: $transition-fast;
  &:hover,
  &--active {
    border-color: $apple-blue;
    color: $apple-blue;
  }
  &--active {
    background: var(--accent-soft);
  }
}
.count {
  margin-left: auto;
  font-size: 12px;
  color: $color-secondary;
  font-weight: 400;
}
</style>
