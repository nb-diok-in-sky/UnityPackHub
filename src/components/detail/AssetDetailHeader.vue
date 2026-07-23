<script setup lang="ts">
defineProps<{ title: string }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <header class="header">
    <span class="title">{{ title }}</span>
    <q-btn flat round dense icon="close" size="sm" @click="$emit('close')" />
  </header>
</template>

<style scoped lang="scss">
@use "../../styles/variables" as *;
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid $color-border;
}
.title {
  font-size: 15px;
  font-weight: 600;
  color: $color-text;
}
</style>
