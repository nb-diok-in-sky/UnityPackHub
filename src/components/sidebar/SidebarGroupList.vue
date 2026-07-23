<script setup lang="ts">
import type { AssetGroup } from "../../types/asset";

defineProps<{
  groups: AssetGroup[];
  activeId: string | null;
  editLabel: string;
  deleteLabel: string;
}>();
defineEmits<{
  select: [id: string];
  edit: [group: AssetGroup];
  delete: [id: string];
}>();
</script>

<template>
  <nav class="nav">
    <button
      v-for="group in groups"
      :key="group.id"
      class="item"
      :class="{ 'item--active': activeId === group.id }"
      @click="$emit('select', group.id)"
      @contextmenu.prevent
    >
      <q-icon :name="group.icon" size="18px" />
      <span>{{ group.name }}</span>
      <span class="count">{{ group.assetIds.length }}</span>
      <q-menu context-menu>
        <q-list dense>
          <q-item clickable v-close-popup @click="$emit('edit', group)">
            <q-item-section>{{ editLabel }}</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="$emit('delete', group.id)">
            <q-item-section class="text-negative">{{
              deleteLabel
            }}</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </button>
  </nav>
</template>

<style scoped lang="scss">
@use "../../styles/variables" as *;
.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border: 0;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: $color-text;
  transition: $transition-fast;
  text-align: left;
  width: 100%;
  &:hover {
    background: var(--hover-overlay);
  }
  &--active {
    background: var(--accent-soft);
    color: $apple-blue;
  }
}
.count {
  margin-left: auto;
  font-size: 12px;
  color: $color-secondary;
  font-weight: 400;
}
</style>
