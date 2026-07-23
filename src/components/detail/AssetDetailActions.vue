<script setup lang="ts">
defineProps<{
  isModel: boolean;
  isFavorite: boolean;
  isImporting: boolean;
  isLocating: boolean;
  status: string;
  importingLabel: string;
  importLabel: string;
  revealLabel: string;
}>();
defineEmits<{
  favorite: [];
  import: [];
  reveal: [];
  locate: [];
  searchStore: [];
}>();
</script>

<template>
  <div class="name-row">
    <slot name="name" />
    <q-btn
      flat
      round
      dense
      :icon="isFavorite ? 'star' : 'star_border'"
      :color="isFavorite ? 'amber' : 'grey-5'"
      size="sm"
      @click="$emit('favorite')"
    />
  </div>
  <div class="actions">
    <q-btn
      unelevated
      dense
      no-caps
      icon="download"
      :label="isImporting ? importingLabel : importLabel"
      :loading="isImporting"
      color="primary"
      class="action-button"
      @click="$emit('import')"
    />
    <q-btn
      outline
      dense
      no-caps
      icon="folder_open"
      :label="revealLabel"
      color="grey-7"
      class="action-button"
      @click="$emit('reveal')"
    />
    <q-btn
      v-if="isModel"
      outline
      dense
      no-caps
      icon="my_location"
      label="在 Unity 中定位"
      color="primary"
      class="action-button"
      :loading="isLocating"
      @click="$emit('locate')"
    />
    <q-btn
      outline
      dense
      no-caps
      icon="storefront"
      label="Unity 商店搜索"
      color="grey-7"
      class="action-button"
      @click="$emit('searchStore')"
    />
    <div v-if="status" class="status">
      <q-icon name="info" color="primary" size="14px" />
      <span>{{ status }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/variables" as *;
.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.action-button {
  border-radius: $radius-button;
  font-size: 13px;
  padding: 6px 12px;
}
.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: $color-secondary;
  padding: 2px 0;
}
</style>
