<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "../services/i18n";
import { useSidebarManagement } from "../composables/useSidebarManagement";
import SidebarKindSwitcher from "./sidebar/SidebarKindSwitcher.vue";
import SidebarGroupList from "./sidebar/SidebarGroupList.vue";
import SidebarTagList from "./sidebar/SidebarTagList.vue";
import SidebarEntityDialog from "./sidebar/SidebarEntityDialog.vue";
import type {
  EditableGroup,
  EditableTag,
} from "../composables/useSidebarManagement";

const { t } = useI18n();
const sidebar = useSidebarManagement();

const groupDialogTitle = computed(() =>
  sidebar.groupDraft.value?.id ? t.editGroup : t.newGroup,
);
const tagDialogTitle = computed(() =>
  sidebar.tagDraft.value?.id ? t.editTag : t.newTag,
);
const groupSaveLabel = computed(() =>
  sidebar.groupDraft.value?.id ? t.save : t.create,
);
const tagSaveLabel = computed(() =>
  sidebar.tagDraft.value?.id ? t.save : t.create,
);

function saveGroup(value: EditableGroup | EditableTag): void {
  if ("name" in value) void sidebar.saveGroup(value);
}

function saveTag(value: EditableGroup | EditableTag): void {
  if ("label" in value) void sidebar.saveTag(value);
}
</script>

<template>
  <div class="sidebar">
    <SidebarKindSwitcher
      :active-kind="sidebar.assetStore.activeAssetKind"
      :package-count="sidebar.assetStore.packageCount"
      :model-count="sidebar.assetStore.modelCount"
      :package-label="t.packages"
      :model-label="t.models"
      @select="sidebar.selectAssetKind"
    />

    <div class="divider" />
    <button
      class="sidebar-item"
      :class="{ 'sidebar-item--active': sidebar.assetStore.showFavoritesOnly }"
      @click="sidebar.selectFavorites"
    >
      <q-icon name="star" size="18px" color="amber" />
      <span>{{ t.favorites }}</span>
      <span class="count">{{ sidebar.assetStore.favoriteCount }}</span>
    </button>

    <div class="divider" />
    <div class="section-header">{{ t.groups }}</div>
    <SidebarGroupList
      :groups="sidebar.visibleGroups.value"
      :active-id="sidebar.groupStore.activeGroupId"
      :edit-label="t.edit"
      :delete-label="t.delete"
      @select="sidebar.selectGroup"
      @edit="sidebar.editGroup"
      @delete="sidebar.deleteGroup"
    />
    <button class="add-button" @click="sidebar.createGroup">
      <q-icon name="add" size="16px" />
      <span>{{ t.newGroup }}</span>
    </button>

    <div class="divider" />
    <div class="section-header">{{ t.tags }}</div>
    <SidebarTagList
      :tags="sidebar.tagStore.tags"
      :active-id="sidebar.tagStore.activeTagId"
      :painting-id="sidebar.assetStore.paintingTagId"
      :edit-label="t.edit"
      :delete-label="t.delete"
      @select="sidebar.selectTag"
      @edit="sidebar.editTag"
      @delete="sidebar.deleteTag"
      @paint="sidebar.assetStore.startTagPaint"
    />
    <button class="add-button" @click="sidebar.createTag">
      <q-icon name="add" size="16px" />
      <span>{{ t.newTag }}</span>
    </button>

    <SidebarEntityDialog
      v-model="sidebar.groupDraft.value"
      kind="group"
      :title="groupDialogTitle"
      :field-label="t.groupName"
      :cancel-label="t.cancel"
      :save-label="groupSaveLabel"
      @save="saveGroup"
    />
    <SidebarEntityDialog
      v-model="sidebar.tagDraft.value"
      kind="tag"
      :title="tagDialogTitle"
      :field-label="t.tagName"
      :cancel-label="t.cancel"
      :save-label="tagSaveLabel"
      @save="saveTag"
    />
  </div>
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;

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
.sidebar-item {
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
.divider {
  height: 1px;
  background: $color-divider;
  margin: 12px 8px;
}
.section-header {
  padding: 4px 12px;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 600;
  color: $color-secondary;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.add-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  margin-top: 4px;
  border: 0;
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
</style>
