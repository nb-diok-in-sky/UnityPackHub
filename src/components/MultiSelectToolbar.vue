<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAssetStore } from '../stores/assetStore'
import { useTagStore } from '../stores/tagStore'
import { useI18n } from '../services/i18n'
import { commandManager } from '../services/commandManager'
import { BatchTagCommand } from '../services/commands/BatchTagCommand'
import { BatchRemoveTagCommand } from '../services/commands/BatchRemoveTagCommand'
import { BatchDeleteCommand } from '../services/commands/BatchDeleteCommand'
import { BatchFavoriteCommand } from '../services/commands/BatchFavoriteCommand'

const assetStore = useAssetStore()
const tagStore = useTagStore()
const { t, tr } = useI18n()

const showTagMenu = ref(false)
const showConfirmDelete = ref(false)

const selectedCount = computed(() => assetStore.selectedIds.size)

const canUndo = computed(() => commandManager.canUndo)

async function reloadAssets(): Promise<void> {
  await assetStore.load()
}

async function handleBatchAddTag(tagId: string): Promise<void> {
  const ids = [...assetStore.selectedIds]
  const command = new BatchTagCommand(ids, tagId, reloadAssets)
  await commandManager.execute(command)
  showTagMenu.value = false
  assetStore.clearSelection()
}

async function handleBatchRemoveTag(tagId: string): Promise<void> {
  const ids = [...assetStore.selectedIds]
  const command = new BatchRemoveTagCommand(ids, tagId, reloadAssets)
  await commandManager.execute(command)
}

async function handleBatchFavorite(): Promise<void> {
  const ids = [...assetStore.selectedIds]
  const command = new BatchFavoriteCommand(ids, true, reloadAssets)
  await commandManager.execute(command)
  assetStore.clearSelection()
}

async function handleBatchUnfavorite(): Promise<void> {
  const ids = [...assetStore.selectedIds]
  const command = new BatchFavoriteCommand(ids, false, reloadAssets)
  await commandManager.execute(command)
  assetStore.clearSelection()
}

async function handleBatchDelete(): Promise<void> {
  const ids = [...assetStore.selectedIds]
  const command = new BatchDeleteCommand(ids, reloadAssets)
  await commandManager.execute(command)
  assetStore.clearSelection()
  showConfirmDelete.value = false
}

async function handleUndo(): Promise<void> {
  await commandManager.undo()
}

function handleSelectAll(): void {
  assetStore.selectAll()
}

function handleClearSelection(): void {
  assetStore.clearSelection()
}
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
          @update:model-value="handleClearSelection"
        />
        <span class="multi-toolbar__count">
          {{ selectedCount }} {{ t.selected }}
        </span>
        <q-btn
          flat dense
          :label="t.selectAll"
          size="sm"
          class="multi-toolbar__btn-text"
          @click="handleSelectAll"
        />
      </div>

      <div class="multi-toolbar__actions">
        <!-- Add Tag -->
        <q-btn
          flat dense round
          icon="label"
          size="sm"
          class="multi-toolbar__btn"
          title="Add Tag"
        >
          <q-menu v-model="showTagMenu">
            <q-list dense>
              <q-item-label header>{{ t.addTag }}</q-item-label>
              <q-item
                v-for="tag in tagStore.tags"
                :key="tag.id"
                clickable
                v-close-popup
                @click="handleBatchAddTag(tag.id)"
              >
                <q-item-section side>
                  <span
                    class="multi-toolbar__tag-dot"
                    :style="{ background: tag.color }"
                  />
                </q-item-section>
                <q-item-section>{{ tag.label }}</q-item-section>
              </q-item>
              <q-separator v-if="tagStore.tags.length > 0" />
              <q-item-label v-if="tagStore.tags.length > 0" header>{{ t.removeTag }}</q-item-label>
              <q-item
                v-for="tag in tagStore.tags"
                :key="'rm-' + tag.id"
                clickable
                v-close-popup
                @click="handleBatchRemoveTag(tag.id)"
              >
                <q-item-section side>
                  <q-icon name="remove_circle_outline" size="14px" color="negative" />
                </q-item-section>
                <q-item-section>{{ tag.label }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <!-- Favorite -->
        <q-btn
          flat dense round
          icon="star"
          size="sm"
          class="multi-toolbar__btn"
          :title="t.favorite"
          @click="handleBatchFavorite"
        />

        <!-- Unfavorite -->
        <q-btn
          flat dense round
          icon="star_border"
          size="sm"
          class="multi-toolbar__btn"
          :title="t.unfavorite"
          @click="handleBatchUnfavorite"
        />

        <!-- Delete -->
        <q-btn
          flat dense round
          icon="delete_outline"
          size="sm"
          class="multi-toolbar__btn multi-toolbar__btn--danger"
          :title="t.delete"
          @click="showConfirmDelete = true"
        />

        <div class="multi-toolbar__divider" />

        <!-- Undo -->
        <q-btn
          flat dense round
          icon="undo"
          size="sm"
          class="multi-toolbar__btn"
          :disable="!canUndo"
          :title="t.undo + ' (Ctrl+Z)'"
          @click="handleUndo"
        />

        <!-- Close -->
        <q-btn
          flat dense round
          icon="close"
          size="sm"
          class="multi-toolbar__btn"
          :title="t.cancel"
          @click="handleClearSelection"
        />
      </div>

      <!-- Delete Confirmation -->
      <q-dialog v-model="showConfirmDelete">
        <q-card class="confirm-dialog">
          <q-card-section>
            <div class="text-h6">{{ t.deleteAssets }}</div>
          </q-card-section>
          <q-card-section>
            {{ tr('deleteConfirm', { count: selectedCount }) }}
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat :label="t.cancel" color="grey" v-close-popup />
            <q-btn flat :label="t.delete" color="negative" @click="handleBatchDelete" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.multi-toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: $topbar-height;
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: $glass-blur;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 100;

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__count {
    font-size: 14px;
    font-weight: 500;
    color: white;
  }

  &__btn-text {
    color: rgba(255, 255, 255, 0.7) !important;
    font-size: 12px;

    &:hover {
      color: white !important;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__btn {
    color: rgba(255, 255, 255, 0.85) !important;

    &:hover {
      color: white !important;
      background: rgba(255, 255, 255, 0.12) !important;
    }

    &--danger:hover {
      color: $apple-red !important;
    }
  }

  &__divider {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.2);
    margin: 0 4px;
  }

  &__tag-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }
}

.toolbar-enter-active,
.toolbar-leave-active {
  transition: transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1),
              opacity 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.toolbar-enter-from,
.toolbar-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.confirm-dialog {
  border-radius: $radius-dialog;
  min-width: 360px;
}
</style>
