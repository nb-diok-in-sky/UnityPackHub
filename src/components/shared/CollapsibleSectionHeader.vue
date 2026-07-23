<script setup lang="ts">
defineProps<{ title: string; open: boolean; loading?: boolean }>();
defineEmits<{ toggle: [] }>();
</script>
<template>
  <header class="header">
    <span>{{ title }}</span>
    <div class="header__actions">
      <slot name="actions" /><q-btn
        flat
        round
        dense
        :icon="open ? 'expand_less' : 'expand_more'"
        size="xs"
        color="grey-7"
        :loading="loading"
        @click="$emit('toggle')"
      />
    </div>
  </header>
</template>
<style scoped lang="scss">
@use "../../styles/variables" as *;
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: $color-secondary;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.header__actions {
  display: flex;
  gap: 2px;
}
</style>
