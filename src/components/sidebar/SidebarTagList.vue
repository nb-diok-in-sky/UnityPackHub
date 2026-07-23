<script setup lang="ts">
import type { Tag } from "../../types/asset";

defineProps<{
  tags: Tag[];
  activeId: string | null;
  paintingId: string | null;
  editLabel: string;
  deleteLabel: string;
}>();
defineEmits<{
  select: [id: string];
  edit: [tag: Tag];
  delete: [id: string];
  paint: [id: string];
}>();
</script>

<template>
  <nav class="nav">
    <div v-for="tag in tags" :key="tag.id" class="row">
      <button
        class="item"
        :class="{ 'item--active': activeId === tag.id }"
        @click="$emit('select', tag.id)"
        @contextmenu.prevent
      >
        <span class="dot" :style="{ background: tag.color }" />
        <span>{{ tag.label }}</span>
        <q-menu context-menu>
          <q-list dense>
            <q-item clickable v-close-popup @click="$emit('edit', tag)">
              <q-item-section>{{ editLabel }}</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="$emit('delete', tag.id)">
              <q-item-section class="text-negative">{{
                deleteLabel
              }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </button>
      <q-btn
        flat
        round
        dense
        icon="brush"
        size="8px"
        class="paint-button"
        :class="{ 'paint-button--active': paintingId === tag.id }"
        :title="paintingId === tag.id ? '退出涂抹模式' : '涂抹赋予标签'"
        @click.stop="$emit('paint', tag.id)"
      />
    </div>
  </nav>
</template>

<style scoped lang="scss">
@use "../../styles/variables" as *;
.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row {
  display: flex;
  align-items: center;
  gap: 2px;
}
.item {
  flex: 1;
  min-width: 0;
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
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.paint-button {
  opacity: 0;
  transition: $transition-fast;
  color: $color-secondary !important;
  .row:hover & {
    opacity: 0.6;
  }
  &--active {
    opacity: 1 !important;
    color: $apple-blue !important;
    background: var(--accent-soft) !important;
  }
}
</style>
