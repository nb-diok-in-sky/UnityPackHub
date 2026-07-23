<script setup lang="ts">
import BatchDeleteDialog from './batch/BatchDeleteDialog.vue'
import BatchTagMenu from './batch/BatchTagMenu.vue'
import { useBatchAssetActions } from '../composables/useBatchAssetActions'
import { useI18n } from '../services/i18n'

const {
  assetStore,
  selectedCount,
  canUndo,
  deleteDialogOpen,
  addTag,
  removeTag,
  favorite,
  unfavorite,
  deleteSelected,
  undo,
} = useBatchAssetActions()
const { t } = useI18n()
</script>

<template>
  <Transition name="toolbar">
    <div v-if="selectedCount > 0" class="multi-toolbar">
      <div class="multi-toolbar__left">
        <q-checkbox
          :model-value="true"
          dense
          color="white"
          dark
          @update:model-value="assetStore.clearSelection"
        />
        <span class="multi-toolbar__count">{{ selectedCount }} {{ t.selected }}</span>
        <q-btn
          flat dense size="sm"
          class="multi-toolbar__btn-text"
          :label="t.selectAll"
          @click="assetStore.selectAll"
        />
      </div>

      <div class="multi-toolbar__actions">
        <q-btn flat dense round icon="label" size="sm" class="multi-toolbar__btn" title="Add Tag">
          <BatchTagMenu @add="addTag" @remove="removeTag" />
        </q-btn>
        <q-btn flat dense round icon="star" size="sm" class="multi-toolbar__btn" :title="t.favorite" @click="favorite" />
        <q-btn flat dense round icon="star_border" size="sm" class="multi-toolbar__btn" :title="t.unfavorite" @click="unfavorite" />
        <q-btn flat dense round icon="delete_outline" size="sm" class="multi-toolbar__btn multi-toolbar__btn--danger" :title="t.delete" @click="deleteDialogOpen = true" />
        <div class="multi-toolbar__divider" />
        <q-btn flat dense round icon="undo" size="sm" class="multi-toolbar__btn" :disable="!canUndo" :title="`${t.undo} (Ctrl+Z)`" @click="undo" />
        <q-btn flat dense round icon="close" size="sm" class="multi-toolbar__btn" :title="t.cancel" @click="assetStore.clearSelection" />
      </div>

      <BatchDeleteDialog v-model="deleteDialogOpen" :count="selectedCount" @confirm="deleteSelected" />
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.multi-toolbar {
  position: absolute;
  inset: 0 0 auto;
  height: $topbar-height;
  padding: 0 16px;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: $glass-blur;

  &__left,
  &__actions { display: flex; align-items: center; }
  &__left { gap: 8px; }
  &__actions { gap: 4px; }
  &__count { color: white; font-size: 14px; font-weight: 500; }
  &__btn-text { color: rgba(255, 255, 255, 0.7) !important; font-size: 12px; }
  &__btn-text:hover,
  &__btn:hover { color: white !important; }
  &__btn { color: rgba(255, 255, 255, 0.85) !important; }
  &__btn:hover { background: rgba(255, 255, 255, 0.12) !important; }
  &__btn--danger:hover { color: $apple-red !important; }
  &__divider { width: 1px; height: 20px; margin: 0 4px; background: rgba(255, 255, 255, 0.2); }
}

.toolbar-enter-active,
.toolbar-leave-active { transition: transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.25s cubic-bezier(0.25, 0.1, 0.25, 1); }
.toolbar-enter-from,
.toolbar-leave-to { transform: translateY(-100%); opacity: 0; }
</style>
