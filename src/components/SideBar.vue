<script setup lang="ts">
import { ref } from 'vue'
import { useAssetStore } from '../stores/assetStore'
import { useTagStore } from '../stores/tagStore'
import { useGroupStore } from '../stores/groupStore'
import { useI18n } from '../services/i18n'

const assetStore = useAssetStore()
const tagStore = useTagStore()
const groupStore = useGroupStore()
const { t } = useI18n()

const showNewTag = ref(false)
const newTagLabel = ref('')
const newTagColor = ref('#007AFF')

const editingTag = ref<{ id: string; label: string; color: string } | null>(null)
const showEditTag = ref(false)

const showNewGroup = ref(false)
const newGroupName = ref('')
const newGroupIcon = ref('folder')

const editingGroup = ref<{ id: string; name: string; icon: string } | null>(null)
const showEditGroup = ref(false)

const GROUP_ICONS = [
  'folder', 'inventory_2', 'category', 'widgets',
  'view_in_ar', 'terrain', 'brush', 'auto_fix_high',
]

const APPLE_COLORS = [
  { label: 'Blue', value: '#007AFF' },
  { label: 'Green', value: '#34C759' },
  { label: 'Orange', value: '#FF9500' },
  { label: 'Red', value: '#FF3B30' },
  { label: 'Purple', value: '#AF52DE' },
  { label: 'Pink', value: '#FF2D55' },
  { label: 'Teal', value: '#5AC8FA' },
  { label: 'Yellow', value: '#FFCC00' },
]

function selectAll(): void {
  tagStore.setActiveTag(null)
  groupStore.setActiveGroup(null)
  assetStore.setFavoritesOnly(false)
}

function selectFavorites(): void {
  tagStore.setActiveTag(null)
  groupStore.setActiveGroup(null)
  assetStore.setFavoritesOnly(true)
}

function selectTag(id: string): void {
  assetStore.setFavoritesOnly(false)
  groupStore.setActiveGroup(null)
  tagStore.setActiveTag(tagStore.activeTagId === id ? null : id)
}

function selectGroup(id: string): void {
  assetStore.setFavoritesOnly(false)
  tagStore.setActiveTag(null)
  groupStore.setActiveGroup(groupStore.activeGroupId === id ? null : id)
}

async function createTag(): Promise<void> {
  const label = newTagLabel.value.trim()
  if (!label) return
  await tagStore.create(label, newTagColor.value)
  newTagLabel.value = ''
  newTagColor.value = '#007AFF'
  showNewTag.value = false
}

function startEditTag(tag: { id: string; label: string; color: string }): void {
  editingTag.value = { ...tag }
  showEditTag.value = true
}

async function saveEditTag(): Promise<void> {
  if (!editingTag.value) return
  const label = editingTag.value.label.trim()
  if (!label) return
  await tagStore.update(editingTag.value.id, { label, color: editingTag.value.color })
  showEditTag.value = false
  editingTag.value = null
}

async function deleteTag(id: string): Promise<void> {
  await tagStore.remove(id)
}

async function createGroup(): Promise<void> {
  const name = newGroupName.value.trim()
  if (!name) return
  await groupStore.create(name, newGroupIcon.value)
  newGroupName.value = ''
  newGroupIcon.value = 'folder'
  showNewGroup.value = false
}

function startEditGroup(group: { id: string; name: string; icon: string }): void {
  editingGroup.value = { ...group }
  showEditGroup.value = true
}

async function saveEditGroup(): Promise<void> {
  if (!editingGroup.value) return
  const name = editingGroup.value.name.trim()
  if (!name) return
  await groupStore.rename(editingGroup.value.id, name)
  await groupStore.setIcon(editingGroup.value.id, editingGroup.value.icon)
  showEditGroup.value = false
  editingGroup.value = null
}

async function deleteGroup(id: string): Promise<void> {
  await groupStore.remove(id)
}
</script>

<template>
  <div class="sidebar">
    <nav class="sidebar__nav">
      <button
        class="sidebar__item"
        :class="{ 'sidebar__item--active': !tagStore.activeTagId && !groupStore.activeGroupId && !assetStore.showFavoritesOnly }"
        @click="selectAll"
      >
        <q-icon name="apps" size="18px" />
        <span>{{ t.all }}</span>
        <span class="sidebar__count">{{ assetStore.totalCount }}</span>
      </button>

      <button
        class="sidebar__item"
        :class="{ 'sidebar__item--active': assetStore.showFavoritesOnly }"
        @click="selectFavorites"
      >
        <q-icon name="star" size="18px" color="amber" />
        <span>{{ t.favorites }}</span>
        <span class="sidebar__count">{{ assetStore.favoriteCount }}</span>
      </button>
    </nav>

    <div class="sidebar__divider" />

    <!-- Groups -->
    <div class="sidebar__section-header">
      <span>{{ t.groups }}</span>
    </div>

    <nav class="sidebar__nav">
      <button
        v-for="group in groupStore.groups"
        :key="group.id"
        class="sidebar__item"
        :class="{ 'sidebar__item--active': groupStore.activeGroupId === group.id }"
        @click="selectGroup(group.id)"
        @contextmenu.prevent
      >
        <q-icon :name="group.icon" size="18px" />
        <span>{{ group.name }}</span>
        <span class="sidebar__count">{{ group.assetIds.length }}</span>

        <q-menu context-menu>
          <q-list dense>
            <q-item clickable v-close-popup @click="startEditGroup(group)">
              <q-item-section>{{ t.edit }}</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="deleteGroup(group.id)">
              <q-item-section class="text-negative">{{ t.delete }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </button>
    </nav>

    <button class="sidebar__add-tag" @click="showNewGroup = true">
      <q-icon name="add" size="16px" />
      <span>{{ t.newGroup }}</span>
    </button>

    <div class="sidebar__divider" />

    <!-- Tags -->
    <div class="sidebar__section-header">
      <span>{{ t.tags }}</span>
    </div>

    <nav class="sidebar__nav">
      <div
        v-for="tag in tagStore.tags"
        :key="tag.id"
        class="sidebar__item-row"
      >
        <button
          class="sidebar__item"
          :class="{ 'sidebar__item--active': tagStore.activeTagId === tag.id }"
          @click="selectTag(tag.id)"
          @contextmenu.prevent
        >
          <span class="sidebar__dot" :style="{ background: tag.color }" />
          <span>{{ tag.label }}</span>

          <q-menu context-menu>
          <q-list dense>
            <q-item clickable v-close-popup @click="startEditTag(tag)">
              <q-item-section>{{ t.edit }}</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="deleteTag(tag.id)">
              <q-item-section class="text-negative">{{ t.delete }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
        </button>
        <q-btn
          flat round dense
          icon="brush"
          size="8px"
          class="sidebar__paint-btn"
          :class="{ 'sidebar__paint-btn--active': assetStore.paintingTagId === tag.id }"
          :title="assetStore.paintingTagId === tag.id ? '退出涂抹模式' : '涂抹赋予标签'"
          @click.stop="assetStore.startTagPaint(tag.id)"
        />
      </div>
    </nav>

    <button class="sidebar__add-tag" @click="showNewTag = true">
      <q-icon name="add" size="16px" />
      <span>{{ t.newTag }}</span>
    </button>

    <!-- New Group Dialog -->
    <q-dialog v-model="showNewGroup">
      <q-card class="tag-dialog">
        <q-card-section>
          <div class="text-h6">{{ t.newGroup }}</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="newGroupName"
            :label="t.groupName"
            dense
            outlined
            autofocus
            @keyup.enter="createGroup"
          />

          <div class="icon-grid q-mt-md">
            <button
              v-for="icon in GROUP_ICONS"
              :key="icon"
              class="icon-option"
              :class="{ 'icon-option--active': newGroupIcon === icon }"
              @click="newGroupIcon = icon"
            >
              <q-icon :name="icon" size="22px" />
            </button>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="t.cancel" color="grey" v-close-popup />
          <q-btn flat :label="t.create" color="primary" @click="createGroup" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Edit Group Dialog -->
    <q-dialog v-model="showEditGroup">
      <q-card v-if="editingGroup" class="tag-dialog">
        <q-card-section>
          <div class="text-h6">{{ t.editGroup }}</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="editingGroup.name"
            :label="t.groupName"
            dense
            outlined
            autofocus
            @keyup.enter="saveEditGroup"
          />

          <div class="icon-grid q-mt-md">
            <button
              v-for="icon in GROUP_ICONS"
              :key="icon"
              class="icon-option"
              :class="{ 'icon-option--active': editingGroup.icon === icon }"
              @click="editingGroup.icon = icon"
            >
              <q-icon :name="icon" size="22px" />
            </button>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="t.cancel" color="grey" v-close-popup />
          <q-btn flat :label="t.save" color="primary" @click="saveEditGroup" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- New Tag Dialog -->
    <q-dialog v-model="showNewTag">
      <q-card class="tag-dialog">
        <q-card-section>
          <div class="text-h6">{{ t.newTag }}</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="newTagLabel"
            :label="t.tagName"
            dense
            outlined
            autofocus
            @keyup.enter="createTag"
          />

          <div class="color-grid q-mt-md">
            <button
              v-for="color in APPLE_COLORS"
              :key="color.value"
              class="color-swatch"
              :class="{ 'color-swatch--active': newTagColor === color.value }"
              :style="{ background: color.value }"
              :title="color.label"
              @click="newTagColor = color.value"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="t.cancel" color="grey" v-close-popup />
          <q-btn flat :label="t.create" color="primary" @click="createTag" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Edit Tag Dialog -->
    <q-dialog v-model="showEditTag">
      <q-card v-if="editingTag" class="tag-dialog">
        <q-card-section>
          <div class="text-h6">{{ t.editTag }}</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="editingTag.label"
            :label="t.tagName"
            dense
            outlined
            autofocus
            @keyup.enter="saveEditTag"
          />

          <div class="color-grid q-mt-md">
            <button
              v-for="color in APPLE_COLORS"
              :key="color.value"
              class="color-swatch"
              :class="{ 'color-swatch--active': editingTag.color === color.value }"
              :style="{ background: color.value }"
              :title="color.label"
              @click="editingTag.color = color.value"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="t.cancel" color="grey" v-close-popup />
          <q-btn flat :label="t.save" color="primary" @click="saveEditTag" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.sidebar {
  width: $sidebar-width;
  height: 100%;
  background: $glass-background;
  backdrop-filter: $glass-blur;
  border-right: 1px solid $color-border;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  font-family: $font-family;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border: none;
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

.sidebar__item-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.sidebar__item-row .sidebar__item {
  flex: 1;
  min-width: 0;
}

.sidebar__paint-btn {
  opacity: 0;
  transition: $transition-fast;
  color: $color-secondary !important;

  .sidebar__item-row:hover & {
    opacity: 0.6;
  }

  &--active {
    opacity: 1 !important;
    color: $apple-blue !important;
    background: var(--accent-soft) !important;
  }
}

.sidebar__count {
  margin-left: auto;
  font-size: 12px;
  color: $color-secondary;
  font-weight: 400;
}

.sidebar__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sidebar__divider {
  height: 1px;
  background: $color-divider;
  margin: 12px 8px;
}

.sidebar__section-header {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  color: $color-secondary;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.sidebar__add-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  margin-top: 4px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  color: $color-secondary;
  transition: $transition-fast;

  &:hover {
    background: var(--hover-overlay);
    color: $apple-blue;
  }
}

.tag-dialog {
  border-radius: $radius-dialog;
  min-width: 320px;
}

.color-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: $transition-fast;

  &--active {
    border-color: $color-text;
    transform: scale(1.15);
  }

  &:hover {
    transform: scale(1.1);
  }
}

.icon-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.icon-option {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 2px solid transparent;
  background: var(--hover-overlay);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-secondary;
  transition: $transition-fast;

  &--active {
    border-color: $apple-blue;
    color: $apple-blue;
    background: var(--accent-soft);
  }

  &:hover {
    color: $apple-blue;
  }
}
</style>
