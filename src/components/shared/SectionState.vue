<script setup lang="ts">
defineProps<{
  loading?: boolean;
  empty?: boolean;
  loadingText?: string;
  emptyText?: string;
}>();
</script>
<template>
  <div v-if="loading" class="state">
    <q-spinner-dots size="20px" color="primary" /><span>{{ loadingText }}</span>
  </div>
  <div v-else-if="empty" class="state">
    <span>{{ emptyText }}</span>
  </div>
  <slot v-else />
</template>
<style scoped lang="scss">
@use "../../styles/variables" as *;
.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 0;
  color: $color-secondary;
  font-size: 12px;
}
</style>
